package tools

import (
	"fmt"
	"strings"

	"github.com/elev1e1nSure/warden/agent/memory"
)

func openMemory() *memory.MemoryStore {
	s := memory.NewMemoryStore("")
	_ = s.Init()
	return s
}

// --- MemoryListTool ---

type MemoryListTool struct{}

func (t *MemoryListTool) Name() string { return "memory_list" }

func (t *MemoryListTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "List stored memory entries, optionally filtered by category.",
		Params: map[string]any{
			"category": prop("string", "Filter by category (e.g. preference, user, project). Omit to list all."),
		},
	}
}

func (t *MemoryListTool) Execute(args map[string]any) Result {
	category := getStr(args, "category")
	store := openMemory()
	defer store.Close()

	entries, err := store.GetEntries("", category)
	if err != nil {
		return R("error: " + err.Error())
	}
	if len(entries) == 0 {
		return R("no memory entries found")
	}

	var sb strings.Builder
	for _, e := range entries {
		fmt.Fprintf(&sb, "[%s] %s = %s (confidence: %.2f)\n", e.Category, e.Key, e.Value, e.Confidence)
	}
	return R(strings.TrimRight(sb.String(), "\n"))
}

// --- MemorySaveTool ---

type MemorySaveTool struct{}

func (t *MemorySaveTool) Name() string { return "memory_save" }

func (t *MemorySaveTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Save or update a memory entry by category and key.",
		Params: map[string]any{
			"category": prop("string", "Category (e.g. preference, user, project)"),
			"key":      prop("string", "Unique key within the category"),
			"value":    prop("string", "Value to store"),
		},
		Required: []string{"category", "key", "value"},
	}
}

func (t *MemorySaveTool) Execute(args map[string]any) Result {
	category := strings.TrimSpace(getStr(args, "category"))
	key := strings.TrimSpace(getStr(args, "key"))
	value := strings.TrimSpace(getStr(args, "value"))

	if category == "" || key == "" || value == "" {
		return R("error: category, key, and value are required")
	}

	store := openMemory()
	defer store.Close()

	if err := store.UpsertEntry("", category, key, value, 1.0, ""); err != nil {
		return R("error: " + err.Error())
	}
	return R(fmt.Sprintf("saved: [%s] %s = %s", category, key, value))
}

// --- MemoryDeleteTool ---

type MemoryDeleteTool struct{}

func (t *MemoryDeleteTool) Name() string { return "memory_delete" }

func (t *MemoryDeleteTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Delete a memory entry by key.",
		Params: map[string]any{
			"key": prop("string", "Key of the entry to delete"),
		},
		Required: []string{"key"},
	}
}

func (t *MemoryDeleteTool) Execute(args map[string]any) Result {
	key := strings.TrimSpace(getStr(args, "key"))
	if key == "" {
		return R("error: key is required")
	}

	store := openMemory()
	defer store.Close()

	n, err := store.DeleteEntry(key)
	if err != nil {
		return R("error: " + err.Error())
	}
	if n == 0 {
		return R(fmt.Sprintf("no entry found with key '%s'", key))
	}
	return R(fmt.Sprintf("deleted %d entry(s) with key '%s'", n, key))
}

// --- MemoryClearTool ---

type MemoryClearTool struct{}

func (t *MemoryClearTool) Name() string { return "memory_clear" }

func (t *MemoryClearTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Clear all memory entries.",
		Params:      map[string]any{},
	}
}

func (t *MemoryClearTool) Execute(args map[string]any) Result {
	store := openMemory()
	defer store.Close()

	n, err := store.ClearEntries("")
	if err != nil {
		return R("error: " + err.Error())
	}
	return R(fmt.Sprintf("cleared %d memory entries", n))
}
