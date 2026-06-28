package agent

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/elev1e1nSure/warden/agent/safety"
	"github.com/elev1e1nSure/warden/agent/skills"
	"github.com/elev1e1nSure/warden/agent/tools"
	"github.com/elev1e1nSure/warden/internal/client"
)

const (
	truncateMaxLines = 2000
	truncateMaxBytes = 50000
	toolTimeout      = 60 * time.Second
	cuMaxSide        = 1280
)

var screenshotTools = map[string]bool{
	"screenshot":         true,
	"browser_screenshot": true,
}

// ToolDefinition is the JSON-schema description of a tool, passed to the LLM.
type ToolDefinition struct {
	Type     string                 `json:"type"`
	Function ToolFunctionDefinition `json:"function"`
}

type ToolFunctionDefinition struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
}

var (
	registryOnce sync.Once
	registry     map[string]tools.Tool
)

func buildRegistry() map[string]tools.Tool {
	todo := tools.NewTodoWriteTool()
	return map[string]tools.Tool{
		"powershell":         &tools.PowerShellTool{},
		"bash":               &tools.BashTool{},
		"file_read":          &tools.FileReadTool{},
		"file_write":         &tools.FileWriteTool{},
		"file_delete":        &tools.FileDeleteTool{},
		"file_list":          &tools.FileListTool{},
		"file_move":          &tools.FileMoveTool{},
		"file_copy":          &tools.FileCopyTool{},
		"glob":               &tools.GlobTool{},
		"grep":               &tools.GrepTool{},
		"edit":               &tools.EditTool{},
		"apply_patch":        &tools.ApplyPatchTool{},
		"archive":            &tools.ArchiveTool{},
		"screenshot":         &tools.ScreenshotTool{},
		"clipboard":          &tools.ClipboardTool{},
		"mouse":              &tools.MouseTool{},
		"keyboard":           &tools.KeyboardTool{},
		"image_locate":       &tools.ImageLocateTool{},
		"ocr":                &tools.OcrTool{},
		"wait_for":           &tools.WaitForTool{},
		"system_info":        &tools.SystemInfoTool{},
		"notify":             &tools.NotifyTool{},
		"process_list":       &tools.ProcessListTool{},
		"process_kill":       &tools.ProcessKillTool{},
		"window_list":        &tools.WindowListTool{},
		"window_focus":       &tools.WindowFocusTool{},
		"window_manage":      &tools.WindowManageTool{},
		"browser_open":       &tools.BrowserOpenTool{},
		"browser_read":       &tools.BrowserReadTool{},
		"browser_screenshot": &tools.BrowserScreenshotTool{},
		"browser_click":      &tools.BrowserClickTool{},
		"browser_fill":       &tools.BrowserFillTool{},
		"youtube_search":     &tools.YouTubeSearchTool{},
		"google_search":      &tools.GoogleSearchTool{},
		"webfetch":           &tools.WebFetchTool{},
		"http_request":       &tools.HttpRequestTool{},
		"todowrite":          todo,
		"skill":              &tools.SkillTool{},
		"question":           &tools.QuestionTool{},
		"memory_list":        &tools.MemoryListTool{},
		"memory_save":        &tools.MemorySaveTool{},
		"memory_delete":      &tools.MemoryDeleteTool{},
		"memory_clear":       &tools.MemoryClearTool{},
	}
}

// Registry returns the singleton tool registry.
func Registry() map[string]tools.Tool {
	registryOnce.Do(func() {
		registry = buildRegistry()
	})
	return registry
}

// Definitions returns tool definitions for the LLM.
func Definitions() []ToolDefinition {
	reg := Registry()
	out := make([]ToolDefinition, 0, len(reg))
	for name := range reg {
		out = append(out, ToolDefinition{
			Type: "function",
			Function: ToolFunctionDefinition{
				Name:        name,
				Description: describe(name),
				Parameters:  schema(name),
			},
		})
	}
	return out
}

func prop(typ, desc string) map[string]any {
	return map[string]any{"type": typ, "description": desc}
}

func schema(name string) map[string]any {
	props := map[string]any{}
	required := []string{}

	req := func(fields ...string) { required = append(required, fields...) }

	switch name {
	case "powershell", "bash":
		props["command"] = prop("string", "Shell command to execute")
		req("command")
	case "file_read":
		props["path"] = prop("string", "Absolute or relative path to read")
		props["offset"] = prop("integer", "Line number to start from (0-based)")
		props["limit"] = prop("integer", "Maximum number of lines to return")
		req("path")
	case "file_write":
		props["path"] = prop("string", "Path to write to")
		props["content"] = prop("string", "Text content to write")
		req("path", "content")
	case "file_delete":
		props["path"] = prop("string", "Path to delete")
		req("path")
	case "file_list":
		props["path"] = prop("string", "Directory to list")
		props["recursive"] = prop("boolean", "List recursively")
	case "file_move", "file_copy":
		props["src"] = prop("string", "Source path")
		props["dst"] = prop("string", "Destination path")
		req("src", "dst")
	case "glob":
		props["pattern"] = prop("string", "Glob pattern, e.g. src/**/*.ts")
		props["dir"] = prop("string", "Root directory (default: cwd)")
		req("pattern")
	case "grep":
		props["pattern"] = prop("string", "Regular expression to search")
		props["path"] = prop("string", "File or directory to search in")
		props["recursive"] = prop("boolean", "Search recursively (default true)")
		req("pattern")
	case "edit":
		props["path"] = prop("string", "File to edit")
		props["old"] = prop("string", "Exact string to replace")
		props["new"] = prop("string", "Replacement string")
		req("path", "old", "new")
	case "apply_patch":
		props["patch"] = prop("string", "Unified diff or OpenCode patch content")
		req("patch")
	case "archive":
		props["action"] = prop("string", "One of: list, create, extract")
		props["path"] = prop("string", "Archive file path")
		props["dest"] = prop("string", "Destination directory (extract only)")
		props["files"] = map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Files to include (create only)"}
		req("action", "path")
	case "screenshot":
		// no required args
	case "clipboard":
		props["action"] = prop("string", "read or write")
		props["text"] = prop("string", "Text to write (write action only)")
	case "mouse":
		props["action"] = prop("string", "move, click, right_click, double_click, scroll, drag")
		props["x"] = prop("integer", "X coordinate in screenshot space")
		props["y"] = prop("integer", "Y coordinate in screenshot space")
		props["x2"] = prop("integer", "End X for drag")
		props["y2"] = prop("integer", "End Y for drag")
		props["amount"] = prop("integer", "Scroll notches (positive=up, negative=down)")
	case "keyboard":
		props["action"] = prop("string", "type (send text) or press (key combo)")
		props["text"] = prop("string", "Text to type, or key combo like ctrl+c")
		req("text")
	case "image_locate":
		props["image"] = prop("string", "Absolute path to the template image to find on screen")
		req("image")
	case "ocr":
		props["image"] = prop("string", "Path to image file; omit to capture the screen")
		props["x"] = prop("integer", "Region X (screenshot space, requires y/w/h)")
		props["y"] = prop("integer", "Region Y")
		props["w"] = prop("integer", "Region width")
		props["h"] = prop("integer", "Region height")
	case "wait_for":
		props["type"] = prop("string", "window, text, or image")
		props["target"] = prop("string", "Window title, text to find, or image path")
		props["timeout"] = prop("number", "Seconds to wait (default 10, max 30)")
		props["interval"] = prop("number", "Poll interval in seconds (default 0.5)")
		req("type", "target")
	case "system_info":
		// no args
	case "notify":
		props["message"] = prop("string", "Notification body")
		props["title"] = prop("string", "Notification title (default: Warden)")
		req("message")
	case "process_list":
		props["filter"] = prop("string", "Optional name filter")
	case "process_kill":
		props["pid"] = prop("integer", "Process ID to kill")
		props["name"] = prop("string", "Process name to kill (kills all matches)")
	case "window_list":
		// no args
	case "window_focus":
		props["title"] = prop("string", "Substring of window title to focus")
		req("title")
	case "window_manage":
		props["title"] = prop("string", "Substring of window title")
		props["action"] = prop("string", "move, resize, minimize, maximize, restore, close")
		props["x"] = prop("integer", "New X position (move)")
		props["y"] = prop("integer", "New Y position (move)")
		props["w"] = prop("integer", "New width (resize)")
		props["h"] = prop("integer", "New height (resize)")
		req("title", "action")
	case "browser_open":
		props["url"] = prop("string", "URL to open")
		req("url")
	case "browser_read":
		// no args
	case "browser_screenshot":
		// no args
	case "browser_click":
		props["selector"] = prop("string", "CSS selector of element to click")
		req("selector")
	case "browser_fill":
		props["selector"] = prop("string", "CSS selector of input")
		props["value"] = prop("string", "Value to fill")
		req("selector", "value")
	case "youtube_search":
		props["query"] = prop("string", "Search query")
		req("query")
	case "google_search":
		props["query"] = prop("string", "Search query")
		req("query")
	case "webfetch":
		props["url"] = prop("string", "URL to fetch")
		req("url")
	case "http_request":
		props["url"] = prop("string", "Full URL including scheme")
		props["method"] = prop("string", "HTTP method: GET, POST, PUT, PATCH, DELETE (default GET)")
		props["body"] = prop("string", "Request body")
		props["headers"] = map[string]any{"type": "object", "description": "Request headers as key-value pairs"}
		props["timeout"] = prop("integer", "Timeout in seconds (1-120, default 30)")
		req("url")
	case "todowrite":
		props["todos"] = map[string]any{
			"type":        "array",
			"description": "Updated todo list",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"id":      prop("string", "Unique id"),
					"content": prop("string", "Task description"),
					"status":  prop("string", "pending, in_progress, or completed"),
					"priority": prop("string", "high, medium, or low"),
				},
			},
		}
		req("todos")
	case "skill":
		props["name"] = prop("string", "Skill name to load")
		req("name")
	case "question":
		props["question"] = prop("string", "Question to ask the user")
		props["options"] = map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Optional answer choices"}
		req("question")
	case "memory_list":
		props["category"] = prop("string", "Filter by category (e.g. preference, user, project). Omit to list all.")
	case "memory_save":
		props["category"] = prop("string", "Category (e.g. preference, user, project)")
		props["key"] = prop("string", "Unique key within the category")
		props["value"] = prop("string", "Value to store")
		req("category", "key", "value")
	case "memory_delete":
		props["key"] = prop("string", "Key of the entry to delete")
		req("key")
	case "memory_clear":
		// no args
	}

	out := map[string]any{
		"type":       "object",
		"properties": props,
	}
	if len(required) > 0 {
		out["required"] = required
	}
	return out
}

func describe(name string) string {
	switch name {
	case "powershell":
		return "Execute a PowerShell command and return stdout/stderr."
	case "bash":
		return "Execute a bash shell command and return stdout/stderr."
	case "file_read":
		return "Read a UTF-8 text file from the workspace."
	case "file_write":
		return "Write text content to a file inside the workspace."
	case "file_delete":
		return "Delete a file inside the workspace."
	case "file_list":
		return "List entries of a directory."
	case "file_move":
		return "Move a file inside the workspace."
	case "file_copy":
		return "Copy a file inside the workspace."
	case "glob":
		return "Find files matching a glob pattern."
	case "grep":
		return "Search file contents with a regular expression."
	case "edit":
		return "Apply a precise string replacement to a file."
	case "apply_patch":
		return "Apply a unified or OpenCode-style patch to files."
	case "archive":
		return "List, create, or extract archives."
	case "screenshot":
		return "Capture the primary display to a PNG file."
	case "clipboard":
		return "Read from or write to the clipboard."
	case "mouse":
		return "Move, click, or scroll the mouse."
	case "keyboard":
		return "Type text or press key combinations."
	case "image_locate":
		return "Locate a sub-image on screen and return coordinates."
	case "ocr":
		return "Recognize text on the screen."
	case "wait_for":
		return "Poll until a UI condition is met."
	case "system_info":
		return "Read system information."
	case "notify":
		return "Show a desktop notification."
	case "process_list":
		return "List running processes."
	case "process_kill":
		return "Terminate a process by PID or name."
	case "window_list":
		return "List visible windows."
	case "window_focus":
		return "Bring a window to the foreground."
	case "window_manage":
		return "Move, resize, minimize, maximize, or close a window."
	case "browser_open":
		return "Open a URL in the browser."
	case "browser_read":
		return "Read the current page text from the browser."
	case "browser_screenshot":
		return "Take a screenshot of the browser viewport."
	case "browser_click":
		return "Click an element matching a CSS selector."
	case "browser_fill":
		return "Fill an input matching a CSS selector."
	case "youtube_search":
		return "Search YouTube and return results."
	case "google_search":
		return "Search Google and return results."
	case "webfetch":
		return "Fetch a URL and return its text content."
	case "http_request":
		return "Perform an HTTP request."
	case "todowrite":
		return "Update the session todo list."
	case "skill":
		return "Load a skill by name."
	case "question":
		return "Ask the user a structured question."
	case "memory_list":
		return "List stored memory entries, optionally filtered by category."
	case "memory_save":
		return "Save or update a memory entry by category and key."
	case "memory_delete":
		return "Delete a memory entry by key."
	case "memory_clear":
		return "Clear all memory entries."
	}
	return name
}

// truncate cuts large tool outputs so they don't blow up the LLM context.
func truncate(text string) string {
	if text == "" {
		return text
	}
	lines := strings.Split(text, "\n")
	totalLines := len(lines)
	totalBytes := len(text)
	if totalLines <= truncateMaxLines && totalBytes <= truncateMaxBytes {
		return text
	}
	maxL := truncateMaxLines
	if totalLines < maxL {
		maxL = totalLines
	}
	truncated := strings.Join(lines[:maxL], "\n")
	if len(truncated) > truncateMaxBytes {
		truncated = truncated[:truncateMaxBytes]
	}
	marker := fmt.Sprintf("\n…[truncated: showing first %d of %d lines, %d of %d bytes]…\n",
		maxL, totalLines, len(truncated), totalBytes)
	return truncated + marker
}

func extractSavedPath(result string) string {
	if !strings.HasPrefix(result, "saved: ") {
		return ""
	}
	rest := strings.TrimPrefix(result, "saved: ")
	if i := strings.Index(rest, " ("); i >= 0 {
		rest = rest[:i]
	}
	rest = strings.TrimSpace(rest)
	if _, err := os.Stat(rest); err == nil {
		return rest
	}
	return ""
}

// encodeImage loads a PNG file, downscales so its longest side is at most maxSide,
// and returns base64-encoded PNG bytes.
func encodeImage(path string, maxSide int) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	img, _, err := image.Decode(f)
	if err != nil {
		return ""
	}
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	longest := w
	if h > longest {
		longest = h
	}
	if longest > maxSide {
		scale := float64(maxSide) / float64(longest)
		nw := int(float64(w) * scale)
		nh := int(float64(h) * scale)
		if nw < 1 {
			nw = 1
		}
		if nh < 1 {
			nh = 1
		}
		img = downscaleNearest(img, nw, nh)
	}
	var buf bytes.Buffer
	enc := base64.NewEncoder(base64.StdEncoding, &buf)
	if err := png.Encode(enc, img); err != nil {
		return ""
	}
	enc.Close()
	return buf.String()
}

func downscaleNearest(src image.Image, newW, newH int) image.Image {
	sb := src.Bounds()
	srcW, srcH := sb.Dx(), sb.Dy()
	dst := image.NewRGBA(image.Rect(0, 0, newW, newH))
	for y := 0; y < newH; y++ {
		sy := sb.Min.Y + y*srcH/newH
		for x := 0; x < newW; x++ {
			sx := sb.Min.X + x*srcW/newW
			dst.Set(x, y, src.At(sx, sy))
		}
	}
	return dst
}

func resolvePreview(args map[string]any, fallback string) string {
	if cmd, ok := args["command"].(string); ok && cmd != "" {
		return cmd
	}
	if p, ok := args["path"].(string); ok && p != "" {
		if abs, err := filepath.Abs(p); err == nil {
			return abs
		}
		return p
	}
	return fallback
}

func formatArgs(args map[string]any) string {
	b, err := json.Marshal(args)
	if err != nil {
		return "{}"
	}
	return string(b)
}

// executeToolCall runs a single tool call, emitting events to ch and recording
// results into history.
func executeToolCall(
	tc ToolCall,
	autoMode bool,
	history *[]map[string]any,
	confirmMgr *ConfirmationManager,
	questionMgr *QuestionManager,
	addToolResult func(name, result, toolCallID string),
	ch chan<- client.Event,
) {
	name := tc.Function.Name
	if name == "" {
		return
	}
	toolCallID := tc.ID

	reg := Registry()
	tool, ok := reg[name]
	if !ok {
		msg := fmt.Sprintf("error: tool '%s' not found", name)
		addToolResult(name, msg, toolCallID)
		ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: "", Result: msg}}
		return
	}

	args := tools.ParseArgs(tc.Function.Arguments)
	argsStr := formatArgs(args)

	// ── question tool: interactive flow ──
	if name == "question" {
		if questionMgr == nil {
			addToolResult(name, "error: no question manager", toolCallID)
			ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: "error: no question manager"}}
			return
		}
		questions := toQuestionItems(args["questions"])
		if len(questions) == 0 {
			addToolResult(name, "error: no questions provided", toolCallID)
			ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: "error: no questions"}}
			return
		}
		callID, _ := questionMgr.Register(questions)
		ch <- client.EventQuestion{ID: callID, Questions: questions}
		answers := questionMgr.Wait(callID)
		if answers == nil {
			answers = make([][]string, len(questions))
		}
		resultStr := formatQuestionAnswers(questions, answers)
		ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: resultStr}}
		addToolResult(name, resultStr, toolCallID)
		return
	}

	// ── regular tool with safety ──
	mode := "ask"
	if autoMode {
		mode = "auto"
	}
	cwd, _ := os.Getwd()
	decision := safety.AssessToolCall(name, args, cwd, mode)
	if decision.Risk == "blocked" {
		blocked := "blocked: " + decision.Reason
		addToolResult(name, blocked, toolCallID)
		ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: blocked}}
		return
	}
	if decision.Risk == "confirm" {
		if confirmMgr == nil {
			addToolResult(name, "cancelled: no confirmation manager", toolCallID)
			ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: "cancelled"}}
			return
		}
		callID, _ := confirmMgr.Register()
		ch <- client.EventConfirm{
			ID:         callID,
			Tool:       name,
			Risk:       decision.Risk,
			Title:      decision.Summary,
			Summary:    decision.Reason,
			Details:    decision.Details,
			Args:       argsStr,
			Preview:    resolvePreview(args, argsStr),
			DefaultVal: "cancel",
		}
		if !confirmMgr.Wait(callID) {
			addToolResult(name, "cancelled by user", toolCallID)
			ch <- client.EventTool{Tool: client.ToolMsg{Name: name, Args: argsStr, Result: "cancelled"}}
			return
		}
	}

	ch <- client.EventToolStart{Name: name, Args: argsStr}
	resultStr, diffStr := runToolWithTimeout(tool, args)

	if resultStr == "" {
		resultStr = "(no output)"
	}
	if diffStr == "" {
		resultStr = truncate(resultStr)
	}

	payload := client.ToolMsg{Name: name, Args: argsStr, Result: resultStr}
	if diffStr != "" {
		payload.Diff = diffStr
	}
	ch <- client.EventTool{Tool: payload}
	addToolResult(name, resultStr, toolCallID)

	if screenshotTools[name] {
		if imgPath := extractSavedPath(resultStr); imgPath != "" {
			if b64 := encodeImage(imgPath, cuMaxSide); b64 != "" {
				*history = append(*history, map[string]any{
					"role":    "user",
					"content": "[screenshot attached]",
					"images":  []string{b64},
				})
			}
		}
	}
}

func runToolWithTimeout(tool tools.Tool, args map[string]any) (string, string) {
	type res struct {
		val tools.Result
		err error
	}
	done := make(chan res, 1)
	go func() {
		defer func() {
			if r := recover(); r != nil {
				done <- res{val: tools.Result{Text: fmt.Sprintf("error: panic: %v", r)}}
			}
		}()
		done <- res{val: tool.Execute(args)}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), toolTimeout)
	defer cancel()
	select {
	case r := <-done:
		return r.val.Text, r.val.Diff
	case <-ctx.Done():
		return "error: timeout 60s", ""
	}
}

func toQuestionItems(raw any) []client.QuestionItem {
	items, ok := raw.([]any)
	if !ok {
		return nil
	}
	out := make([]client.QuestionItem, 0, len(items))
	for _, r := range items {
		m, ok := r.(map[string]any)
		if !ok {
			continue
		}
		qi := client.QuestionItem{
			Question: getStrArg(m, "question"),
			Header:   getStrArg(m, "header"),
			Multiple: getBoolArg(m, "multiple"),
		}
		if opts, ok := m["options"].([]any); ok {
			for _, o := range opts {
				om, ok := o.(map[string]any)
				if !ok {
					continue
				}
				qi.Options = append(qi.Options, client.QuestionOption{
					Label:       getStrArg(om, "label"),
					Description: getStrArg(om, "description"),
				})
			}
		}
		out = append(out, qi)
	}
	return out
}

func formatQuestionAnswers(questions []client.QuestionItem, answers [][]string) string {
	parts := make([]string, 0, len(questions))
	for i, q := range questions {
		var a []string
		if i < len(answers) {
			a = answers[i]
		}
		joined := "Unanswered"
		if len(a) > 0 {
			joined = strings.Join(a, ", ")
		}
		parts = append(parts, fmt.Sprintf("%q=%q", q.Question, joined))
	}
	return "User answered: " + strings.Join(parts, ", ")
}

func getStrArg(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func getBoolArg(m map[string]any, key string) bool {
	if v, ok := m[key].(bool); ok {
		return v
	}
	return false
}

func mustJSON(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func skillContextMessages(skill *skills.Skill, args string) []map[string]any {
	callID := "call_skill_" + strings.ReplaceAll(skill.Name, "-", "_")
	skillArgs := map[string]any{"name": skill.Name}
	if args != "" {
		skillArgs["args"] = args
	}
	content := skills.WrapSkillContent(skill)
	if args != "" {
		content = "User provided arguments: " + args + "\n\n" + content
	}
	return []map[string]any{
		{
			"role":       "assistant",
			"content":    "",
			"tool_calls": []map[string]any{
				{
					"id":   callID,
					"type": "function",
					"function": map[string]any{
						"name":      "skill",
						"arguments": mustJSON(skillArgs),
					},
				},
			},
		},
		{
			"role":         "tool",
			"name":         "skill",
			"tool_call_id": callID,
			"content":      content,
		},
	}
}
