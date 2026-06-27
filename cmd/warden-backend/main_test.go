package main

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestArgsToJSON(t *testing.T) {
	tests := []struct {
		name string
		args string
		want string
	}{
		{
			name: "already json",
			args: `{"command": "dir"}`,
			want: `{"command": "dir"}`,
		},
		{
			name: "key value pairs",
			args: "command=dir, recursive=true",
			want: `{"command":"dir","recursive":"true"}`,
		},
		{
			name: "empty args",
			args: "",
			want: `{}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := argsToJSON("test", tt.args)
			// Unmarshal both to check structural equality (order might differ)
			var gotMap, wantMap map[string]any
			if err := json.Unmarshal([]byte(got), &gotMap); err != nil {
				t.Fatalf("failed to unmarshal got: %v", err)
			}
			if err := json.Unmarshal([]byte(tt.want), &wantMap); err != nil {
				t.Fatalf("failed to unmarshal want: %v", err)
			}
			if !reflect.DeepEqual(gotMap, wantMap) {
				t.Errorf("argsToJSON() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRebuildHistory(t *testing.T) {
	blocksJSON := `[
		{"id": "b1", "kind": "user", "text": "hello"},
		{"id": "b2", "kind": "assistant", "text": "hi"},
		{"id": "b3", "kind": "tool", "name": "shell", "args": "command=dir", "result": "files listing", "status": "done"}
	]`

	var blocks []any
	if err := json.Unmarshal([]byte(blocksJSON), &blocks); err != nil {
		t.Fatalf("failed to unmarshal test blocks: %v", err)
	}

	history := rebuildHistory(blocks)

	if len(history) != 4 {
		t.Fatalf("expected history length 4, got %d", len(history))
	}

	if history[0]["role"] != "user" || history[0]["content"] != "hello" {
		t.Errorf("unexpected first message: %v", history[0])
	}

	if history[1]["role"] != "assistant" || history[1]["content"] != "hi" {
		t.Errorf("unexpected second message: %v", history[1])
	}

	// Tool call assistant wrapper
	if history[2]["role"] != "assistant" {
		t.Errorf("expected assistant wrapper for tool call, got: %v", history[2])
	}
	tcs, ok := history[2]["tool_calls"].([]map[string]any)
	if !ok || len(tcs) != 1 {
		t.Fatalf("expected tool calls in assistant wrapper, got: %v", history[2]["tool_calls"])
	}
	if tcs[0]["id"] != "call_b3" || tcs[0]["type"] != "function" {
		t.Errorf("unexpected tool call details: %v", tcs[0])
	}

	// Tool response
	if history[3]["role"] != "tool" || history[3]["tool_call_id"] != "call_b3" || history[3]["content"] != "files listing" {
		t.Errorf("unexpected tool response: %v", history[3])
	}
}

func TestNewUUID(t *testing.T) {
	id1 := newUUID()
	id2 := newUUID()

	if len(id1) != 36 {
		t.Errorf("expected UUID length 36, got %d", len(id1))
	}
	if id1 == id2 {
		t.Errorf("expected unique UUIDs, got identical: %s", id1)
	}
}
