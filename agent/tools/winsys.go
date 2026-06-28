package tools

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"golang.org/x/sys/windows/registry"
)

// psRun runs a PowerShell script with UTF-8 output and returns cleaned output.
func psRun(script string, extraEnv ...string) (string, error) {
	cmd := exec.Command(shellExe(), "-NoProfile", "-NonInteractive", "-Command",
		"[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"+script)
	if len(extraEnv) > 0 {
		cmd.Env = append(os.Environ(), extraEnv...)
	}
	out, err := cmd.CombinedOutput()
	return clean(string(out)), err
}

// --- ServiceListTool ---

type ServiceListTool struct{}

func (t *ServiceListTool) Name() string { return "service_list" }

func (t *ServiceListTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "List Windows services with their status.",
		Params: map[string]any{
			"filter": prop("string", "Optional case-insensitive name/display-name filter"),
		},
	}
}

func (t *ServiceListTool) Execute(args map[string]any) Result {
	out, err := psRun("Get-Service | ForEach-Object { '{0}  {1}  {2}' -f $_.Status, $_.Name, $_.DisplayName }")
	if err != nil && out == "" {
		return R("error: " + err.Error())
	}
	filter := strings.ToLower(strings.TrimSpace(getStr(args, "filter")))
	var rows []string
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		if filter != "" && !strings.Contains(strings.ToLower(line), filter) {
			continue
		}
		rows = append(rows, line)
		if len(rows) >= 200 {
			break
		}
	}
	if len(rows) == 0 {
		if filter != "" {
			return R("no services matching '" + filter + "'")
		}
		return R("no services")
	}
	return R(strings.Join(rows, "\n"))
}

// --- ServiceControlTool ---

type ServiceControlTool struct{}

func (t *ServiceControlTool) Name() string { return "service_control" }

func (t *ServiceControlTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Start, stop, or restart a Windows service by name.",
		Params: map[string]any{
			"name":   prop("string", "Service name (not display name)"),
			"action": prop("string", "start, stop, or restart"),
		},
		Required: []string{"name", "action"},
	}
}

func (t *ServiceControlTool) Execute(args map[string]any) Result {
	name := strings.TrimSpace(getStr(args, "name"))
	if name == "" {
		return R("error: name is required")
	}
	var cmdlet string
	switch strings.ToLower(strings.TrimSpace(getStr(args, "action"))) {
	case "start":
		cmdlet = "Start-Service"
	case "stop":
		cmdlet = "Stop-Service"
	case "restart":
		cmdlet = "Restart-Service"
	default:
		return R("error: action must be start, stop, or restart")
	}
	out, err := psRun(cmdlet+" -Name $env:WARDEN_SVC -ErrorAction Stop", "WARDEN_SVC="+name)
	if err != nil {
		msg := out
		if msg == "" {
			msg = err.Error()
		}
		return R("error: " + trunc(msg, 300))
	}
	return R(fmt.Sprintf("%s: %s", strings.ToLower(getStr(args, "action")), name))
}

// --- RegistryReadTool ---

type RegistryReadTool struct{}

func (t *RegistryReadTool) Name() string { return "registry_read" }

func (t *RegistryReadTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Read a Windows registry value, or list a key's values and subkeys.",
		Params: map[string]any{
			"path":  prop("string", `Registry key, e.g. HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion`),
			"value": prop("string", "Value name to read; omit to list the key's values and subkeys"),
		},
		Required: []string{"path"},
	}
}

func (t *RegistryReadTool) Execute(args map[string]any) Result {
	hive, subkey, err := parseRegPath(getStr(args, "path"))
	if err != nil {
		return R("error: " + err.Error())
	}
	k, err := registry.OpenKey(hive, subkey, registry.QUERY_VALUE|registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		return R("error: " + err.Error())
	}
	defer k.Close()

	if valueName := strings.TrimSpace(getStr(args, "value")); valueName != "" {
		return readRegValue(k, valueName)
	}

	valNames, _ := k.ReadValueNames(0)
	subKeys, _ := k.ReadSubKeyNames(0)
	var b strings.Builder
	if len(valNames) > 0 {
		b.WriteString("values:\n")
		for _, n := range valNames {
			label := n
			if label == "" {
				label = "(Default)"
			}
			fmt.Fprintf(&b, "  %s\n", label)
		}
	}
	if len(subKeys) > 0 {
		b.WriteString("subkeys:\n")
		for _, n := range subKeys {
			fmt.Fprintf(&b, "  %s\n", n)
		}
	}
	if b.Len() == 0 {
		return R("(empty key)")
	}
	return R(strings.TrimRight(b.String(), "\n"))
}

func readRegValue(k registry.Key, name string) Result {
	if s, _, err := k.GetStringValue(name); err == nil {
		return R(s)
	}
	if n, _, err := k.GetIntegerValue(name); err == nil {
		return R(fmt.Sprintf("%d", n))
	}
	if ss, _, err := k.GetStringsValue(name); err == nil {
		return R(strings.Join(ss, "\n"))
	}
	if bin, _, err := k.GetBinaryValue(name); err == nil {
		return R(fmt.Sprintf("%x", bin))
	}
	return R("error: value not found or unsupported type: " + name)
}

func parseRegPath(p string) (registry.Key, string, error) {
	p = strings.ReplaceAll(strings.TrimSpace(p), "/", `\`)
	if p == "" {
		return 0, "", fmt.Errorf("path is required")
	}
	parts := strings.SplitN(p, `\`, 2)
	var hive registry.Key
	switch strings.ToUpper(parts[0]) {
	case "HKLM", "HKEY_LOCAL_MACHINE":
		hive = registry.LOCAL_MACHINE
	case "HKCU", "HKEY_CURRENT_USER":
		hive = registry.CURRENT_USER
	case "HKCR", "HKEY_CLASSES_ROOT":
		hive = registry.CLASSES_ROOT
	case "HKU", "HKEY_USERS":
		hive = registry.USERS
	case "HKCC", "HKEY_CURRENT_CONFIG":
		hive = registry.CURRENT_CONFIG
	default:
		return 0, "", fmt.Errorf("unknown hive: %s", parts[0])
	}
	sub := ""
	if len(parts) == 2 {
		sub = parts[1]
	}
	return hive, sub, nil
}

// --- AppLaunchTool ---

type AppLaunchTool struct{}

func (t *AppLaunchTool) Name() string { return "app_launch" }

func (t *AppLaunchTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Launch an application by path or name, optionally with arguments.",
		Params: map[string]any{
			"path": prop("string", "Executable path or name (e.g. notepad)"),
			"args": prop("string", "Optional command-line arguments"),
		},
		Required: []string{"path"},
	}
}

func (t *AppLaunchTool) Execute(args map[string]any) Result {
	app := strings.TrimSpace(getStr(args, "path"))
	if app == "" {
		return R("error: path is required")
	}
	env := []string{"WARDEN_APP=" + app}
	script := "Start-Process -FilePath $env:WARDEN_APP"
	if appArgs := strings.TrimSpace(getStr(args, "args")); appArgs != "" {
		script += " -ArgumentList $env:WARDEN_APPARGS"
		env = append(env, "WARDEN_APPARGS="+appArgs)
	}
	cmd := exec.Command(shellExe(), "-NoProfile", "-NonInteractive", "-Command", script)
	cmd.Env = append(os.Environ(), env...)
	if err := cmd.Start(); err != nil {
		return R("error: " + err.Error())
	}
	return R("launched: " + app)
}
