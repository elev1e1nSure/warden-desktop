package tools

import (
	"context"
	"net"
	"strconv"
	"strings"
	"time"
)

// --- DnsLookupTool ---

type DnsLookupTool struct{}

func (t *DnsLookupTool) Name() string { return "dns_lookup" }

func (t *DnsLookupTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Resolve a hostname to its IP addresses.",
		Params: map[string]any{
			"host": prop("string", "Hostname to resolve"),
		},
		Required: []string{"host"},
	}
}

func (t *DnsLookupTool) Execute(args map[string]any) Result {
	host := strings.TrimSpace(getStr(args, "host"))
	if host == "" {
		return R("error: host is required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	addrs, err := net.DefaultResolver.LookupHost(ctx, host)
	if err != nil {
		return R("error: " + err.Error())
	}
	if len(addrs) == 0 {
		return R("no addresses found")
	}
	return R(strings.Join(addrs, "\n"))
}

// --- PortCheckTool ---

type PortCheckTool struct{}

func (t *PortCheckTool) Name() string { return "port_check" }

func (t *PortCheckTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Check whether a TCP port is open on a host.",
		Params: map[string]any{
			"host":    prop("string", "Target host"),
			"port":    prop("integer", "TCP port (1-65535)"),
			"timeout": prop("integer", "Connect timeout in seconds (1-30, default 5)"),
		},
		Required: []string{"host", "port"},
	}
}

func (t *PortCheckTool) Execute(args map[string]any) Result {
	host := strings.TrimSpace(getStr(args, "host"))
	if host == "" {
		return R("error: host is required")
	}
	port := getInt(args, "port", 0)
	if port <= 0 || port > 65535 {
		return R("error: port must be between 1 and 65535")
	}
	timeout := clampInt(getInt(args, "timeout", 5), 1, 30)
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	conn, err := net.DialTimeout("tcp", addr, time.Duration(timeout)*time.Second)
	if err != nil {
		return R("closed: " + addr)
	}
	conn.Close()
	return R("open: " + addr)
}
