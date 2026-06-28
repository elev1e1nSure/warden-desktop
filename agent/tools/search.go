package tools

import (
	"crypto/tls"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// --- GoogleSearchTool ---

type GoogleSearchTool struct{}

func (t *GoogleSearchTool) Name() string { return "google_search" }

func (t *GoogleSearchTool) Execute(args map[string]any) Result {
	query := strings.TrimSpace(getStr(args, "query"))
	if query == "" {
		return R("error: query is required")
	}
	maxResults := clampInt(getInt(args, "max_results", 5), 1, 20)

	// DuckDuckGo HTML search — no API key required.
	urlStr := "https://html.duckduckgo.com/html/?q=" + urlEncodeQuery(query)
	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return R("error: " + err.Error())
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return R("error: " + err.Error())
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 500_000))

	results := parseDDGResults(string(raw), maxResults)
	if len(results) == 0 {
		return R("no results found")
	}
	var sb strings.Builder
	for i, r := range results {
		sb.WriteString(strings.Join([]string{
			strings.TrimSpace(r[0]),
			strings.TrimSpace(r[1]),
			strings.TrimSpace(r[2]),
		}, "\n"))
		if i < len(results)-1 {
			sb.WriteString("\n\n")
		}
	}
	return R(sb.String())
}

var (
	ddgResultRe = regexp.MustCompile(`(?is)<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)</a>`)
	ddgSnippetRe = regexp.MustCompile(`(?is)<a[^>]+class="result__snippet"[^>]*>(.*?)</a>`)
)

// parseDDGResults extracts [title, url, snippet] triples from DDG HTML.
func parseDDGResults(html string, max int) [][3]string {
	titleMatches := ddgResultRe.FindAllStringSubmatch(html, max*2)
	snippetMatches := ddgSnippetRe.FindAllStringSubmatch(html, max*2)

	var out [][3]string
	for i, m := range titleMatches {
		if i >= max {
			break
		}
		url := stripDDGRedirect(m[1])
		title := tagRe.ReplaceAllString(m[2], "")
		snippet := ""
		if i < len(snippetMatches) {
			snippet = tagRe.ReplaceAllString(snippetMatches[i][1], "")
			snippet = spaceRe.ReplaceAllString(snippet, " ")
		}
		out = append(out, [3]string{title, url, snippet})
	}
	return out
}

// stripDDGRedirect unwraps DDG redirect URLs to get the actual destination.
func stripDDGRedirect(u string) string {
	// DDG wraps links as //duckduckgo.com/l/?uddg=<encoded-url>&...
	if strings.Contains(u, "uddg=") {
		if idx := strings.Index(u, "uddg="); idx >= 0 {
			encoded := u[idx+5:]
			if end := strings.Index(encoded, "&"); end >= 0 {
				encoded = encoded[:end]
			}
			if decoded, err := urlDecode(encoded); err == nil {
				return decoded
			}
		}
	}
	return u
}

func urlEncodeQuery(s string) string {
	var b strings.Builder
	for _, c := range s {
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9',
			c == '-', c == '_', c == '.', c == '~':
			b.WriteRune(c)
		case c == ' ':
			b.WriteByte('+')
		default:
			b.WriteString(percentEncode(c))
		}
	}
	return b.String()
}

func percentEncode(c rune) string {
	bytes := []byte(string(c))
	var s strings.Builder
	for _, b := range bytes {
		s.WriteString("%" + hexByte(b))
	}
	return s.String()
}

func hexByte(b byte) string {
	const hex = "0123456789ABCDEF"
	return string([]byte{hex[b>>4], hex[b&0xf]})
}

func urlDecode(s string) (string, error) {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		if s[i] == '%' && i+2 < len(s) {
			hi := hexVal(s[i+1])
			lo := hexVal(s[i+2])
			if hi >= 0 && lo >= 0 {
				b.WriteByte(byte(hi<<4 | lo))
				i += 2
				continue
			}
		}
		if s[i] == '+' {
			b.WriteByte(' ')
		} else {
			b.WriteByte(s[i])
		}
	}
	return b.String(), nil
}

func hexVal(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}

// --- WebFetchTool ---

type WebFetchTool struct{}

func (t *WebFetchTool) Name() string { return "webfetch" }

func (t *WebFetchTool) Execute(args map[string]any) Result {
	urlStr := getStr(args, "url")
	fmt_ := getStr(args, "format")
	if fmt_ == "" {
		fmt_ = "markdown"
	}
	timeout := clampInt(getInt(args, "timeout", 15), 1, 60)
	verify := true
	if v, ok := args["verify_ssl"].(bool); !ok {
		verify = v
	}

	if !strings.HasPrefix(urlStr, "http://") && !strings.HasPrefix(urlStr, "https://") {
		return R("error: URL must start with http:// or https://")
	}
	if !isSSRFSafeURL(urlStr) {
		return R("error: URL is blocked (SSRF or file scheme)")
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return R("error: " + err.Error())
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	acceptMap := map[string]string{
		"markdown": "text/markdown;q=1.0, text/html;q=0.8, text/plain;q=0.7, */*;q=0.1",
		"text":     "text/plain;q=1.0, text/html;q=0.8, */*;q=0.1",
		"html":     "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
	}
	if a, ok := acceptMap[fmt_]; ok {
		req.Header.Set("Accept", a)
	}

	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: !verify},
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		if strings.Contains(err.Error(), "certificate") {
			return R("error: SSL certificate verification failed (set verify_ssl=false to bypass)")
		}
		return R("error: " + err.Error())
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 200_000))
	return processWebContent(string(raw), resp.Header.Get("Content-Type"), fmt_)
}

func processWebContent(content, contentType, format string) Result {
	decoded := string(content)
	if len(decoded) > 10000 {
		decoded = decoded[:10000]
	}

	isHTML := strings.Contains(contentType, "text/html") || strings.Contains(contentType, "html")
	if format == "markdown" && isHTML {
		return R(htmlToMarkdown(decoded))
	}
	if format == "text" && isHTML {
		return R(htmlToText(decoded))
	}
	return R(decoded)
}

// --- HTML helpers ---

var (
	scriptRe = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleRe  = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	tagRe    = regexp.MustCompile(`<[^>]+>`)
	spaceRe  = regexp.MustCompile(`\s+`)
)

func htmlToText(html string) string {
	text := scriptRe.ReplaceAllString(html, "")
	text = styleRe.ReplaceAllString(text, "")
	text = tagRe.ReplaceAllString(text, "")
	text = spaceRe.ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

func htmlToMarkdown(html string) string {
	// Simple HTML→text conversion (no external lib)
	return htmlToText(html)
}
