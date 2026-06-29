package client

type StatusResult struct {
	Model      string `json:"model"`
	Mode       string `json:"mode"`
	CWD        string `json:"cwd"`
	TokenCount int    `json:"token_count"`
	TokenLimit int    `json:"token_limit"`
}

type MemoryState struct {
	Enabled   bool `json:"enabled"`
	Entries   int  `json:"entries"`
	Snapshots int  `json:"snapshots"`
	DBSize    int  `json:"db_size"`
}

type ToolMsg struct {
	Type   string `json:"type"`
	Name   string `json:"name"`
	Args   string `json:"args"`
	Result string `json:"result"`
	Diff   string `json:"diff"`
}

