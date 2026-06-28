package tools

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// --- FileStatTool ---

type FileStatTool struct{}

func (t *FileStatTool) Name() string { return "file_stat" }

func (t *FileStatTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Get metadata for a file or directory (size, type, modified time, mode).",
		Params: map[string]any{
			"path": prop("string", "Path to inspect"),
		},
		Required: []string{"path"},
	}
}

func (t *FileStatTool) Execute(args map[string]any) Result {
	path := strings.TrimSpace(getStr(args, "path"))
	if path == "" {
		return R("error: path is required")
	}
	fi, err := os.Stat(path)
	if err != nil {
		return R("error: " + err.Error())
	}
	kind := "file"
	if fi.IsDir() {
		kind = "directory"
	}
	abs, _ := filepath.Abs(path)
	return R(fmt.Sprintf("path: %s\ntype: %s\nsize: %d bytes\nmodified: %s\nmode: %s",
		abs, kind, fi.Size(), fi.ModTime().Format("2006-01-02 15:04:05"), fi.Mode().String()))
}

// --- DownloadTool ---

type DownloadTool struct{}

func (t *DownloadTool) Name() string { return "download" }

func (t *DownloadTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Download a URL to a file inside the workspace (binary-safe).",
		Params: map[string]any{
			"url":  prop("string", "Source URL (http/https)"),
			"path": prop("string", "Destination path inside the workspace"),
		},
		Required: []string{"url", "path"},
	}
}

func (t *DownloadTool) Execute(args map[string]any) Result {
	rawURL := strings.TrimSpace(getStr(args, "url"))
	if !strings.HasPrefix(rawURL, "http://") && !strings.HasPrefix(rawURL, "https://") {
		return R("error: URL must start with http:// or https://")
	}
	if !isSSRFSafeURL(rawURL) {
		return R("error: URL is blocked (SSRF or file scheme)")
	}
	dest := strings.TrimSpace(getStr(args, "path"))
	if dest == "" {
		return R("error: path is required")
	}
	if !inCwd(dest) {
		return R("error: path is outside current directory")
	}
	absDest, err := filepath.Abs(dest)
	if err != nil {
		return R("error: " + err.Error())
	}
	if d := filepath.Dir(absDest); d != "" {
		os.MkdirAll(d, 0755)
	}

	client := &http.Client{Timeout: 50 * time.Second}
	resp, err := client.Get(rawURL)
	if err != nil {
		return R("error: " + err.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return R("error: HTTP " + resp.Status)
	}

	f, err := os.Create(absDest)
	if err != nil {
		return R("error: " + err.Error())
	}
	const maxBytes = 100 << 20 // 100 MB
	n, err := io.Copy(f, io.LimitReader(resp.Body, maxBytes+1))
	f.Close()
	if err != nil {
		os.Remove(absDest)
		return R("error: " + err.Error())
	}
	if n > maxBytes {
		os.Remove(absDest)
		return R("error: file exceeds 100MB limit")
	}
	return R(fmt.Sprintf("saved: %s (%d bytes)", dest, n))
}

// --- OpenPathTool ---

type OpenPathTool struct{}

func (t *OpenPathTool) Name() string { return "open_path" }

func (t *OpenPathTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Open a file, folder, or URL with its default application.",
		Params: map[string]any{
			"path": prop("string", "File path, folder, or URL to open"),
		},
		Required: []string{"path"},
	}
}

func (t *OpenPathTool) Execute(args map[string]any) Result {
	target := strings.TrimSpace(getStr(args, "path"))
	if target == "" {
		return R("error: path is required")
	}
	cmd := exec.Command(shellExe(), "-NoProfile", "-NonInteractive", "-Command",
		"Start-Process -FilePath $env:WARDEN_OPEN_TARGET")
	cmd.Env = append(os.Environ(), "WARDEN_OPEN_TARGET="+target)
	if err := cmd.Start(); err != nil {
		return R("error: " + err.Error())
	}
	return R("opened: " + target)
}

// --- RecycleTool ---

type RecycleTool struct{}

func (t *RecycleTool) Name() string { return "recycle" }

func (t *RecycleTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Send a file or directory to the Recycle Bin (recoverable, unlike file_delete).",
		Params: map[string]any{
			"path": prop("string", "Path to send to the Recycle Bin"),
		},
		Required: []string{"path"},
	}
}

const recycleScript = `Add-Type -AssemblyName Microsoft.VisualBasic
$p = $env:WARDEN_RECYCLE_PATH
if (Test-Path -Path $p -PathType Container) {
	[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
} else {
	[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, 'OnlyErrorDialogs', 'SendToRecycleBin')
}`

func (t *RecycleTool) Execute(args map[string]any) Result {
	path := strings.TrimSpace(getStr(args, "path"))
	if path == "" {
		return R("error: path is required")
	}
	if !inCwd(path) {
		return R("error: cannot recycle outside current directory")
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return R("error: " + err.Error())
	}
	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return R("error: not found: " + path)
	}
	cmd := exec.Command(shellExe(), "-NoProfile", "-NonInteractive", "-Command", recycleScript)
	cmd.Env = append(os.Environ(), "WARDEN_RECYCLE_PATH="+absPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		msg := clean(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return R("error: " + trunc(msg, 300))
	}
	return R("recycled: " + path)
}

// --- EnvTool ---

type EnvTool struct{}

func (t *EnvTool) Name() string { return "env" }

func (t *EnvTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Read an environment variable by name, or list all when no name is given.",
		Params: map[string]any{
			"name": prop("string", "Variable name; omit to list all"),
		},
	}
}

func (t *EnvTool) Execute(args map[string]any) Result {
	if name := strings.TrimSpace(getStr(args, "name")); name != "" {
		if v, ok := os.LookupEnv(name); ok {
			return R(v)
		}
		return R("(not set)")
	}
	envs := os.Environ()
	sort.Strings(envs)
	return R(strings.Join(envs, "\n"))
}
