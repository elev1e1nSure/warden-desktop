package tools

import (
	"fmt"
	"strings"
)

// --- SkillTool ---

type SkillTool struct{}

func (t *SkillTool) Name() string { return "skill" }

func (t *SkillTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Load a skill by name.",
		Params: map[string]any{
			"name": prop("string", "Skill name to load"),
		},
		Required: []string{"name"},
	}
}

func (t *SkillTool) Execute(args map[string]any) Result {
	return R("error: skill tool not implemented in Go yet")
}

// --- TodoWriteTool ---

type TodoItem struct {
	Content  string `json:"content"`
	Status   string `json:"status"`
	Priority string `json:"priority"`
}

type TodoWriteTool struct {
	sessionID string
}

func NewTodoWriteTool() *TodoWriteTool {
	return &TodoWriteTool{sessionID: "default"}
}

func (t *TodoWriteTool) Name() string { return "todowrite" }

func (t *TodoWriteTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Update the session todo list.",
		Params: map[string]any{
			"todos": map[string]any{
				"type":        "array",
				"description": "Updated todo list",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"content":  prop("string", "Task description"),
						"status":   prop("string", "pending, in_progress, or completed"),
						"priority": prop("string", "high, medium, or low"),
					},
				},
			},
		},
		Required: []string{"todos"},
	}
}

func (t *TodoWriteTool) SetSession(id string) {
	t.sessionID = id
}

func (t *TodoWriteTool) Execute(args map[string]any) Result {
	raw, ok := args["todos"]
	if !ok {
		return R("error: todos list is required")
	}
	items, ok := raw.([]any)
	if !ok || len(items) == 0 {
		return R("error: todos list is empty")
	}
	var todos []TodoItem
	for _, r := range items {
		m, ok := r.(map[string]any)
		if !ok {
			continue
		}
		todos = append(todos, TodoItem{
			Content:  getStr(m, "content"),
			Status:   getStr(m, "status"),
			Priority: getStr(m, "priority"),
		})
	}
	if len(todos) == 0 {
		return R("error: todos list is empty")
	}
	active := 0
	for _, t := range todos {
		if t.Status != "completed" {
			active++
		}
	}
	var b strings.Builder
	b.WriteString(fmt.Sprintf("%d todos — %d total:\n", active, len(todos)))
	for _, t := range todos {
		b.WriteString(fmt.Sprintf("  [%s] %s: %s\n", t.Status, t.Priority, t.Content))
	}
	return R(strings.TrimRight(b.String(), "\n"))
}

// --- QuestionTool ---

type QuestionTool struct{}

func (t *QuestionTool) Name() string { return "question" }

func (t *QuestionTool) Spec() ToolSpec {
	return ToolSpec{
		Description: "Ask the user one or more structured questions and wait for answers.",
		Params: map[string]any{
			"questions": map[string]any{
				"type":        "array",
				"description": "Questions to ask the user",
				"items": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"question": prop("string", "The question text"),
						"header":   prop("string", "Short label for the question"),
						"multiple": prop("boolean", "Allow selecting multiple options"),
						"options": map[string]any{
							"type":        "array",
							"description": "Optional answer choices",
							"items": map[string]any{
								"type": "object",
								"properties": map[string]any{
									"label":       prop("string", "Option label"),
									"description": prop("string", "Optional explanation of the option"),
								},
							},
						},
					},
				},
			},
		},
		Required: []string{"questions"},
	}
}

func (t *QuestionTool) Execute(args map[string]any) Result {
	return R("error: question tool needs interactive flow")
}
