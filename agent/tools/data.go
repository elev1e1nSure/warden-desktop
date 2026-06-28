package tools

import (
	"crypto/md5"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // embed the IANA tz database so timezones work without OS tzdata
	"unicode/utf8"
)

// --- NowTool ---

type NowTool struct{}

func (t *NowTool) Name() string { return "now" }

func (t *NowTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Get the current date and time, optionally in a specific timezone.",
		Params: map[string]any{
			"timezone": prop("string", "IANA timezone, e.g. Asia/Tokyo (default: local)"),
			"format":   prop("string", "Go time layout, or one of: rfc3339, unix, date, time (default rfc3339)"),
		},
	}
}

func (t *NowTool) Execute(args map[string]any) Result {
	now := time.Now()
	if tz := strings.TrimSpace(getStr(args, "timezone")); tz != "" {
		loc, err := time.LoadLocation(tz)
		if err != nil {
			return R("error: unknown timezone: " + tz)
		}
		now = now.In(loc)
	}
	switch strings.ToLower(strings.TrimSpace(getStr(args, "format"))) {
	case "", "rfc3339":
		return R(now.Format(time.RFC3339))
	case "unix":
		return R(strconv.FormatInt(now.Unix(), 10))
	case "date":
		return R(now.Format("2006-01-02"))
	case "time":
		return R(now.Format("15:04:05"))
	default:
		return R(now.Format(getStr(args, "format")))
	}
}

// --- HashTool ---

type HashTool struct{}

func (t *HashTool) Name() string { return "hash" }

func (t *HashTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Compute a cryptographic hash of text or a file.",
		Params: map[string]any{
			"algo": prop("string", "md5, sha1, or sha256 (default sha256)"),
			"text": prop("string", "Text to hash (use this or path)"),
			"path": prop("string", "File to hash (use this or text)"),
		},
	}
}

func (t *HashTool) Execute(args map[string]any) Result {
	var data []byte
	if p := strings.TrimSpace(getStr(args, "path")); p != "" {
		b, err := os.ReadFile(p)
		if err != nil {
			return R("error: " + err.Error())
		}
		data = b
	} else if text, ok := args["text"].(string); ok {
		data = []byte(text)
	} else {
		return R("error: provide text or path")
	}

	algo := strings.ToLower(strings.TrimSpace(getStr(args, "algo")))
	if algo == "" {
		algo = "sha256"
	}
	switch algo {
	case "md5":
		sum := md5.Sum(data)
		return R(hex.EncodeToString(sum[:]))
	case "sha1":
		sum := sha1.Sum(data)
		return R(hex.EncodeToString(sum[:]))
	case "sha256":
		sum := sha256.Sum256(data)
		return R(hex.EncodeToString(sum[:]))
	default:
		return R("error: algo must be md5, sha1, or sha256")
	}
}

// --- Base64Tool ---

type Base64Tool struct{}

func (t *Base64Tool) Name() string { return "base64" }

func (t *Base64Tool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Base64-encode or -decode text.",
		Params: map[string]any{
			"action": prop("string", "encode or decode (default encode)"),
			"text":   prop("string", "Text to encode, or base64 to decode"),
		},
		Required: []string{"text"},
	}
}

func (t *Base64Tool) Execute(args map[string]any) Result {
	text := getStr(args, "text")
	switch strings.ToLower(strings.TrimSpace(getStr(args, "action"))) {
	case "", "encode":
		return R(base64.StdEncoding.EncodeToString([]byte(text)))
	case "decode":
		dec, err := base64.StdEncoding.DecodeString(strings.TrimSpace(text))
		if err != nil {
			return R("error: invalid base64: " + err.Error())
		}
		return R(string(dec))
	default:
		return R("error: action must be encode or decode")
	}
}

// --- UuidTool ---

type UuidTool struct{}

func (t *UuidTool) Name() string { return "uuid" }

func (t *UuidTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Generate random v4 UUIDs.",
		Params: map[string]any{
			"count": prop("integer", "How many to generate (1-100, default 1)"),
		},
	}
}

func (t *UuidTool) Execute(args map[string]any) Result {
	count := clampInt(getInt(args, "count", 1), 1, 100)
	out := make([]string, 0, count)
	for i := 0; i < count; i++ {
		u, err := genUUIDv4()
		if err != nil {
			return R("error: " + err.Error())
		}
		out = append(out, u)
	}
	return R(strings.Join(out, "\n"))
}

func genUUIDv4() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 10
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

// --- JsonQueryTool ---

type JsonQueryTool struct{}

func (t *JsonQueryTool) Name() string { return "json_query" }

func (t *JsonQueryTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Extract a value from a JSON document by a dot/bracket path (e.g. data.items.0.name).",
		Params: map[string]any{
			"json": prop("string", "JSON document"),
			"path": prop("string", "Path like a.b.0.c or a[0].c; empty returns the whole document"),
		},
		Required: []string{"json"},
	}
}

func (t *JsonQueryTool) Execute(args map[string]any) Result {
	var v any
	if err := json.Unmarshal([]byte(getStr(args, "json")), &v); err != nil {
		return R("error: invalid JSON: " + err.Error())
	}
	result, err := jsonTraverse(v, getStr(args, "path"))
	if err != nil {
		return R("error: " + err.Error())
	}
	if s, ok := result.(string); ok {
		return R(s)
	}
	b, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return R("error: " + err.Error())
	}
	return R(string(b))
}

func jsonTraverse(v any, path string) (any, error) {
	path = strings.TrimSpace(path)
	if path == "" || path == "." {
		return v, nil
	}
	path = strings.ReplaceAll(path, "[", ".")
	path = strings.ReplaceAll(path, "]", "")
	cur := v
	for _, tok := range strings.Split(path, ".") {
		if tok == "" {
			continue
		}
		switch node := cur.(type) {
		case map[string]any:
			next, ok := node[tok]
			if !ok {
				return nil, fmt.Errorf("key %q not found", tok)
			}
			cur = next
		case []any:
			idx, err := strconv.Atoi(tok)
			if err != nil {
				return nil, fmt.Errorf("expected array index, got %q", tok)
			}
			if idx < 0 || idx >= len(node) {
				return nil, fmt.Errorf("index %d out of range (len %d)", idx, len(node))
			}
			cur = node[idx]
		default:
			return nil, fmt.Errorf("cannot descend into %q (value is %T)", tok, cur)
		}
	}
	return cur, nil
}

// --- MathEvalTool ---

type MathEvalTool struct{}

func (t *MathEvalTool) Name() string { return "math_eval" }

func (t *MathEvalTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Evaluate an arithmetic expression with + - * / % and parentheses.",
		Params: map[string]any{
			"expr": prop("string", "Expression, e.g. (2 + 3) * 4.5"),
		},
		Required: []string{"expr"},
	}
}

func (t *MathEvalTool) Execute(args map[string]any) Result {
	expr := strings.TrimSpace(getStr(args, "expr"))
	if expr == "" {
		return R("error: expr is required")
	}
	p := &exprParser{s: expr}
	v, err := p.parseExpr()
	if err != nil {
		return R("error: " + err.Error())
	}
	p.skipSpace()
	if p.pos != len(p.s) {
		return R("error: unexpected trailing input")
	}
	if math.IsInf(v, 0) || math.IsNaN(v) {
		return R("error: result is not a finite number")
	}
	return R(strconv.FormatFloat(v, 'g', -1, 64))
}

// exprParser is a minimal recursive-descent arithmetic evaluator.
type exprParser struct {
	s   string
	pos int
}

func (p *exprParser) skipSpace() {
	for p.pos < len(p.s) && (p.s[p.pos] == ' ' || p.s[p.pos] == '\t') {
		p.pos++
	}
}

func (p *exprParser) parseExpr() (float64, error) {
	v, err := p.parseTerm()
	if err != nil {
		return 0, err
	}
	for {
		p.skipSpace()
		if p.pos >= len(p.s) {
			break
		}
		op := p.s[p.pos]
		if op != '+' && op != '-' {
			break
		}
		p.pos++
		rhs, err := p.parseTerm()
		if err != nil {
			return 0, err
		}
		if op == '+' {
			v += rhs
		} else {
			v -= rhs
		}
	}
	return v, nil
}

func (p *exprParser) parseTerm() (float64, error) {
	v, err := p.parseFactor()
	if err != nil {
		return 0, err
	}
	for {
		p.skipSpace()
		if p.pos >= len(p.s) {
			break
		}
		op := p.s[p.pos]
		if op != '*' && op != '/' && op != '%' {
			break
		}
		p.pos++
		rhs, err := p.parseFactor()
		if err != nil {
			return 0, err
		}
		switch op {
		case '*':
			v *= rhs
		case '/':
			if rhs == 0 {
				return 0, fmt.Errorf("division by zero")
			}
			v /= rhs
		case '%':
			if rhs == 0 {
				return 0, fmt.Errorf("division by zero")
			}
			v = math.Mod(v, rhs)
		}
	}
	return v, nil
}

func (p *exprParser) parseFactor() (float64, error) {
	p.skipSpace()
	if p.pos >= len(p.s) {
		return 0, fmt.Errorf("unexpected end of expression")
	}
	switch c := p.s[p.pos]; {
	case c == '+':
		p.pos++
		return p.parseFactor()
	case c == '-':
		p.pos++
		v, err := p.parseFactor()
		return -v, err
	case c == '(':
		p.pos++
		v, err := p.parseExpr()
		if err != nil {
			return 0, err
		}
		p.skipSpace()
		if p.pos >= len(p.s) || p.s[p.pos] != ')' {
			return 0, fmt.Errorf("missing closing parenthesis")
		}
		p.pos++
		return v, nil
	default:
		start := p.pos
		for p.pos < len(p.s) && ((p.s[p.pos] >= '0' && p.s[p.pos] <= '9') || p.s[p.pos] == '.') {
			p.pos++
		}
		if p.pos == start {
			return 0, fmt.Errorf("unexpected character %q", string(c))
		}
		f, err := strconv.ParseFloat(p.s[start:p.pos], 64)
		if err != nil {
			return 0, fmt.Errorf("invalid number: %s", p.s[start:p.pos])
		}
		return f, nil
	}
}

// --- TextStatsTool ---

type TextStatsTool struct{}

func (t *TextStatsTool) Name() string { return "text_stats" }

func (t *TextStatsTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Count lines, words, characters, and bytes of text or a file.",
		Params: map[string]any{
			"text": prop("string", "Text to measure (use this or path)"),
			"path": prop("string", "File to measure (use this or text)"),
		},
	}
}

func (t *TextStatsTool) Execute(args map[string]any) Result {
	var s string
	if p := strings.TrimSpace(getStr(args, "path")); p != "" {
		b, err := os.ReadFile(p)
		if err != nil {
			return R("error: " + err.Error())
		}
		s = string(b)
	} else if text, ok := args["text"].(string); ok {
		s = text
	} else {
		return R("error: provide text or path")
	}

	lines := 0
	if s != "" {
		lines = strings.Count(s, "\n")
		if !strings.HasSuffix(s, "\n") {
			lines++
		}
	}
	return R(fmt.Sprintf("lines: %d\nwords: %d\nchars: %d\nbytes: %d",
		lines, len(strings.Fields(s)), utf8.RuneCountInString(s), len(s)))
}
