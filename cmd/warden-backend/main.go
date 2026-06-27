package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/elev1e1nSure/warden/agent"
	"github.com/elev1e1nSure/warden/agent/memory"
	"github.com/elev1e1nSure/warden/agent/skills"
	"github.com/elev1e1nSure/warden/internal/client"
	"github.com/elev1e1nSure/warden/internal/security"
)

// Config holds the main LLM connection parameters
type WardenConfig struct {
	Model  string `json:"model"`
	APIURL string `json:"api_url"`
	APIKey string `json:"api_key"`
}

type ChatSummary struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	TitleSource string `json:"title_source"` // "manual" | "user" | "llm"
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	Timestamp   string `json:"timestamp"`
	Model       string `json:"model,omitempty"`
}

type ChatDetail struct {
	ChatSummary
	Blocks []any `json:"blocks"`
}

type AppSettings struct {
	DisableSystemPrompt bool `json:"disable_system_prompt"`
}

type PermissionsState struct {
	Files     string `json:"files"`
	Shell     string `json:"shell"`
	Search    string `json:"search"`
	PcControl string `json:"pc_control"`
	Processes string `json:"processes"`
	System    string `json:"system"`
}

type Server struct {
	token        string
	activeChatID string
	chats        map[string]*ChatDetail
	chatSessions map[string]*agent.ChatSession
	settings     AppSettings
	permissions  PermissionsState

	provider  string
	apiURL    string
	apiKey    string
	model     string
	connected bool
	llmClient agent.LLMClient

	mu sync.Mutex
}

func main() {
	s := &Server{
		chats:        make(map[string]*ChatDetail),
		chatSessions: make(map[string]*agent.ChatSession),
		settings:     AppSettings{DisableSystemPrompt: false},
		permissions: PermissionsState{
			Files:     "ask",
			Shell:     "ask",
			Search:    "ask",
			PcControl: "ask",
			Processes: "ask",
			System:    "ask",
		},
	}

	// 1. Setup Auth Token
	token, err := setupToken()
	if err != nil {
		log.Fatalf("failed to setup auth token: %v", err)
	}
	s.token = token
	log.Printf("Auth token generated and saved locally.")

	// 2. Load Warden Configuration (Ollama / OpenRouter)
	s.loadWardenConfig()

	// 3. Load Chat History
	s.loadChats()

	// 4. Load Settings & Permissions
	s.loadSettingsAndPermissions()

	// 5. Setup HTTP Handlers
	mux := http.NewServeMux()

	// Base routes
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /status", s.handleStatus)
	mux.HandleFunc("POST /connect", s.handleConnect)
	mux.HandleFunc("GET /models", s.handleListModels)
	mux.HandleFunc("POST /model/set", s.handleSetModel)
	mux.HandleFunc("POST /mode", s.handleSetMode)
	mux.HandleFunc("POST /confirm", s.handleConfirm)
	mux.HandleFunc("POST /question", s.handleQuestion)
	mux.HandleFunc("POST /reset", s.handleReset)
	mux.HandleFunc("POST /shutdown", s.handleShutdown)

	// Chats routes
	mux.HandleFunc("GET /chats", s.handleListChats)
	mux.HandleFunc("POST /chats/new", s.handleNewChat)
	mux.HandleFunc("POST /chats/select", s.handleSelectChat)
	mux.HandleFunc("GET /chats/{id}", s.handleGetChat)
	mux.HandleFunc("POST /chats/blocks", s.handleSaveChatBlocks)
	mux.HandleFunc("POST /chats/rename", s.handleRenameChat)
	mux.HandleFunc("POST /chats/delete", s.handleDeleteChat)

	// Skills routes
	mux.HandleFunc("GET /skills", s.handleListSkills)

	// Memory routes
	mux.HandleFunc("GET /memory/state", s.handleGetMemoryState)
	mux.HandleFunc("POST /memory/state", s.handleSetMemoryState)
	mux.HandleFunc("POST /memory/clear", s.handleClearMemory)
	mux.HandleFunc("GET /memory/snapshot", s.handleMemorySnapshot)

	// Settings & Permissions routes
	mux.HandleFunc("GET /settings", s.handleGetSettings)
	mux.HandleFunc("POST /settings", s.handleSetSettings)
	mux.HandleFunc("GET /permissions", s.handleGetPermissions)
	mux.HandleFunc("POST /permissions", s.handleSetPermission)

	// Upload route
	mux.HandleFunc("POST /upload", s.handleUpload)

	// Chat Stream route
	mux.HandleFunc("POST /chat", s.handleChatStream)

	// Start server on port 8765
	addr := "127.0.0.1:8765"
	log.Printf("Starting Go backend server on %s", addr)
	
	server := &http.Server{
		Addr:    addr,
		Handler: s.enableCORS(s.verifyToken(mux)),
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server listen failed: %v", err)
	}
}

// CORS middleware
func (s *Server) enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Warden-Token, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// Token verification middleware
func (s *Server) verifyToken(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}
		tHeader := r.Header.Get("X-Warden-Token")
		if tHeader != s.token {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func setupToken() (string, error) {
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(tokenBytes)

	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		localAppData = filepath.Join(home, ".local", "share")
	}
	wardenDir := filepath.Join(localAppData, "warden")
	if err := os.MkdirAll(wardenDir, 0700); err != nil {
		return "", err
	}
	tokenPath := filepath.Join(wardenDir, ".token")
	if err := os.WriteFile(tokenPath, []byte(token), 0600); err != nil {
		return "", err
	}
	return token, nil
}

func getWardenDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".warden")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	return dir, nil
}

func configPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".warden-config.json"), nil
}

func (s *Server) loadWardenConfig() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.apiURL = "https://openrouter.ai/api/v1"
	s.model = "google/gemini-2.5-flash"
	s.provider = "openrouter"

	path, err := configPath()
	if err != nil {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var cfg WardenConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return
	}
	plainKey, err := security.DecryptString(cfg.APIKey)
	if err != nil {
		return
	}
	s.apiKey = strings.Trim(plainKey, " \t\r\n\x00")
	if cfg.APIURL != "" {
		s.apiURL = cfg.APIURL
	}
	if cfg.Model != "" {
		s.model = cfg.Model
	}

	if s.apiKey != "" {
		if strings.Contains(s.apiURL, "openrouter") {
			s.llmClient = agent.NewOpenAIClient(s.apiURL, s.apiKey)
			s.provider = "openrouter"
		} else {
			s.llmClient = agent.NewOpenAIClient(s.apiURL, s.apiKey)
			s.provider = "openai"
		}
		s.connected = true
	} else {
		// Default to local Ollama if no API key is specified
		s.llmClient = agent.NewOllamaClient("")
		s.provider = "ollama"
		s.connected = true
	}
}

func (s *Server) saveWardenConfig() {
	path, err := configPath()
	if err != nil {
		return
	}
	encryptedKey, err := security.EncryptString(s.apiKey)
	if err != nil {
		return
	}
	cfg := WardenConfig{
		Model:  s.model,
		APIURL: s.apiURL,
		APIKey: encryptedKey,
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err == nil {
		_ = os.WriteFile(path, data, 0600)
	}
}

func (s *Server) loadChats() {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir, err := getWardenDir()
	if err != nil {
		return
	}
	chatsPath := filepath.Join(dir, "chats.json")
	data, err := os.ReadFile(chatsPath)
	if err != nil {
		return
	}

	var storage struct {
		ActiveChatID string                 `json:"active_chat_id"`
		Chats        map[string]*ChatDetail `json:"chats"`
	}
	if err := json.Unmarshal(data, &storage); err == nil {
		s.activeChatID = "" // Always start with a new empty chat on startup
		s.chats = storage.Chats
		if s.chats == nil {
			s.chats = make(map[string]*ChatDetail)
		}
	}
}

func (s *Server) saveChats() {
	dir, err := getWardenDir()
	if err != nil {
		return
	}
	chatsPath := filepath.Join(dir, "chats.json")

	storage := struct {
		ActiveChatID string                 `json:"active_chat_id"`
		Chats        map[string]*ChatDetail `json:"chats"`
	}{
		ActiveChatID: s.activeChatID,
		Chats:        s.chats,
	}
	data, err := json.MarshalIndent(storage, "", "  ")
	if err == nil {
		_ = os.WriteFile(chatsPath, data, 0600)
	}
}

func (s *Server) loadSettingsAndPermissions() {
	s.mu.Lock()
	defer s.mu.Unlock()

	dir, err := getWardenDir()
	if err != nil {
		return
	}
	settingsPath := filepath.Join(dir, "settings.json")
	data, err := os.ReadFile(settingsPath)
	if err == nil {
		var storage struct {
			Settings    AppSettings      `json:"settings"`
			Permissions PermissionsState `json:"permissions"`
		}
		if err := json.Unmarshal(data, &storage); err == nil {
			s.settings = storage.Settings
			s.permissions = storage.Permissions
		}
	}
}

func (s *Server) saveSettingsAndPermissions() {
	dir, err := getWardenDir()
	if err != nil {
		return
	}
	settingsPath := filepath.Join(dir, "settings.json")

	storage := struct {
		Settings    AppSettings      `json:"settings"`
		Permissions PermissionsState `json:"permissions"`
	}{
		Settings:    s.settings,
		Permissions: s.permissions,
	}
	data, err := json.MarshalIndent(storage, "", "  ")
	if err == nil {
		_ = os.WriteFile(settingsPath, data, 0600)
	}
}

// --- Handler Implementations ---

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cwd, _ := os.Getwd()
	tokenCount := 0
	tokenLimit := 4000

	activeID := s.activeChatID
	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			tokenCount = session.TokenCount
			tokenLimit = session.TokenLimit
		}
	}

	mode := "ask"
	// Check if active chat has autoMode or read from current settings
	// For simplicity, we default to ask

	resp := struct {
		Model      string `json:"model"`
		Provider   string `json:"provider"`
		Connected  bool   `json:"connected"`
		Mode       string `json:"mode"`
		CWD        string `json:"cwd"`
		TokenCount int    `json:"token_count"`
		TokenLimit int    `json:"token_limit"`
	}{
		Model:      s.model,
		Provider:   s.provider,
		Connected:  s.connected,
		Mode:       mode,
		CWD:        cwd,
		TokenCount: tokenCount,
		TokenLimit: tokenLimit,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleConnect(w http.ResponseWriter, r *http.Request) {
	var req struct {
		APIKey string `json:"api_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.apiKey = strings.Trim(req.APIKey, " \t\r\n\x00")
	if s.model == "" {
		s.model = "google/gemini-2.5-flash"
	}
	if s.apiURL == "" {
		s.apiURL = "https://openrouter.ai/api/v1"
	}

	var llm agent.LLMClient
	if s.apiKey != "" {
		if strings.Contains(s.apiURL, "openrouter") {
			llm = agent.NewOpenAIClient(s.apiURL, s.apiKey)
			s.provider = "openrouter"
		} else {
			llm = agent.NewOpenAIClient(s.apiURL, s.apiKey)
			s.provider = "openai"
		}
	} else {
		llm = agent.NewOllamaClient("")
		s.provider = "ollama"
	}
	s.mu.Unlock()

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := llm.ListModels(ctx)

	s.mu.Lock()
	if err != nil {
		s.connected = false
		s.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"ok": false, "error": err.Error()})
		return
	}

	s.llmClient = llm
	s.connected = true
	s.saveWardenConfig()
	s.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}

func (s *Server) handleListModels(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	llm := s.llmClient
	currentModel := s.model
	s.mu.Unlock()

	if llm == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"models":  []string{},
			"current": currentModel,
			"error":   "not connected",
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	list, err := llm.ListModels(ctx)

	resp := map[string]any{
		"models":  list,
		"current": currentModel,
		"error":   "",
	}
	if err != nil {
		resp["error"] = err.Error()
		if list == nil {
			resp["models"] = []string{}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleSetModel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Model string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	s.model = req.Model
	s.saveWardenConfig()
	// Update active chat session if present
	if s.activeChatID != "" {
		if sess, ok := s.chatSessions[s.activeChatID]; ok {
			sess.Model = req.Model
			sess.TokenLimit = agent.GuessContextLimit(req.Model)
		}
	}
	s.mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleSetMode(w http.ResponseWriter, r *http.Request) {
	// Mode toggle endpoint, currently stubbed
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleConfirm(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
		Ok bool   `json:"ok"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			if session.ConfirmationManager.Resolve(req.ID, req.Ok) {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
	}
	http.Error(w, "invalid confirmation ID", http.StatusNotFound)
}

func (s *Server) handleQuestion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID      string     `json:"id"`
		Answers [][]string `json:"answers"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			if session.QuestionManager.Resolve(req.ID, req.Answers) {
				w.WriteHeader(http.StatusOK)
				return
			}
		}
	}
	http.Error(w, "invalid question ID", http.StatusNotFound)
}

func (s *Server) handleReset(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	s.activeChatID = ""
	s.saveChats()
	s.mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleShutdown(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			session.Cancel()
		}
	}
	w.WriteHeader(http.StatusOK)
	go func() {
		time.Sleep(500 * time.Millisecond)
		os.Exit(0)
	}()
}

// --- Chat History API Handlers ---

func (s *Server) handleListChats(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var list []ChatSummary
	for _, c := range s.chats {
		list = append(list, c.ChatSummary)
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].UpdatedAt > list[j].UpdatedAt
	})

	var activeID *string
	if s.activeChatID != "" {
		activeID = &s.activeChatID
	}

	resp := struct {
		Chats        []ChatSummary `json:"chats"`
		ActiveChatID *string       `json:"active_chat_id"`
	}{
		Chats:        list,
		ActiveChatID: activeID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleNewChat(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := "chat_" + newUUID()
	now := time.Now().UTC().Format(time.RFC3339)
	ts := fmt.Sprintf("%d", time.Now().Unix())

	chat := &ChatDetail{
		ChatSummary: ChatSummary{
			ID:          id,
			Title:       "New Chat",
			TitleSource: "user",
			CreatedAt:   now,
			UpdatedAt:   now,
			Timestamp:   ts,
			Model:       s.model,
		},
		Blocks: []any{},
	}

	s.chats[id] = chat
	s.activeChatID = id
	s.saveChats()

	resp := struct {
		Chat *ChatDetail `json:"chat"`
	}{
		Chat: chat,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleSelectChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	chat, ok := s.chats[req.ID]
	if !ok {
		s.mu.Unlock()
		http.Error(w, "chat not found", http.StatusNotFound)
		return
	}
	s.activeChatID = req.ID
	s.saveChats()
	s.mu.Unlock()

	resp := struct {
		Chat *ChatDetail `json:"chat"`
	}{
		Chat: chat,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleGetChat(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mu.Lock()
	chat, ok := s.chats[id]
	s.mu.Unlock()

	if !ok {
		http.Error(w, "chat not found", http.StatusNotFound)
		return
	}

	resp := struct {
		Chat *ChatDetail `json:"chat"`
	}{
		Chat: chat,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleSaveChatBlocks(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID     string `json:"id"`
		Blocks []any  `json:"blocks"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	chat, ok := s.chats[req.ID]
	if ok {
		chat.Blocks = req.Blocks
		chat.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		chat.Timestamp = fmt.Sprintf("%d", time.Now().Unix())
		s.saveChats()
	}
	s.mu.Unlock()

	if !ok {
		http.Error(w, "chat not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleRenameChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	chat, ok := s.chats[req.ID]
	if ok {
		chat.Title = req.Title
		chat.TitleSource = "manual"
		chat.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		s.saveChats()
	}
	s.mu.Unlock()

	if !ok {
		http.Error(w, "chat not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleDeleteChat(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	delete(s.chats, req.ID)
	delete(s.chatSessions, req.ID)
	if s.activeChatID == req.ID {
		s.activeChatID = ""
		for cid := range s.chats {
			s.activeChatID = cid
			break
		}
	}
	s.saveChats()
	s.mu.Unlock()

	w.WriteHeader(http.StatusOK)
}

// --- Skills Handler ---

func (s *Server) handleListSkills(w http.ResponseWriter, r *http.Request) {
	list := skills.DiscoverSkills()
	out := make([]map[string]any, len(list))
	for i, sk := range list {
		out[i] = map[string]any{
			"name":        sk.Name,
			"description": sk.Description,
			"location":    sk.Location,
			"content":     skills.WrapSkillContent(&list[i]),
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"skills": out})
}

// --- Memory API Handlers ---

func (s *Server) handleGetMemoryState(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	enabled := false
	entries := 0
	snapshots := 0
	dbSize := 0

	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			stats := session.MemoryStore.GetStats()
			enabled = stats.Enabled
			entries = stats.Entries
			snapshots = stats.Snapshots
			dbSize = int(stats.DBSize)
		}
	}

	resp := struct {
		Enabled   bool `json:"enabled"`
		Entries   int  `json:"entries"`
		Snapshots int  `json:"snapshots"`
		DBSize    int  `json:"db_size"`
	}{
		Enabled:   enabled,
		Entries:   entries,
		Snapshots: snapshots,
		DBSize:    dbSize,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleSetMemoryState(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			_ = session.MemoryStore.SetEnabled(req.Enabled)
		}
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleClearMemory(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	activeID := s.activeChatID
	s.mu.Unlock()

	count := 0
	if activeID != "" {
		if session, ok := s.chatSessions[activeID]; ok {
			count, _ = session.MemoryStore.ClearEntries("")
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"cleared": count})
}

func (s *Server) handleMemorySnapshot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{})
}

// --- Settings & Permissions API Handlers ---

func (s *Server) handleGetSettings(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.settings)
}

func (s *Server) handleSetSettings(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req AppSettings
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.settings = req
	s.saveSettingsAndPermissions()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.settings)
}

func (s *Server) handleGetPermissions(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.permissions)
}

func (s *Server) handleSetPermission(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var req map[string]string
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	for k, v := range req {
		switch k {
		case "files":
			s.permissions.Files = v
		case "shell":
			s.permissions.Shell = v
		case "search":
			s.permissions.Search = v
		case "pc_control":
			s.permissions.PcControl = v
		case "processes":
			s.permissions.Processes = v
		case "system":
			s.permissions.System = v
		}
	}
	s.saveSettingsAndPermissions()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s.permissions)
}

// --- Upload Handler ---

func (s *Server) handleUpload(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(32 << 20)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var savedFiles []map[string]string
	files := r.MultipartForm.File["files"]
	for _, fileHeader := range files {
		file, err := fileHeader.Open()
		if err != nil {
			continue
		}
		defer file.Close()

		dir, err := getWardenDir()
		if err != nil {
			continue
		}
		attachmentsDir := filepath.Join(dir, "attachments")
		_ = os.MkdirAll(attachmentsDir, 0700)

		outPath := filepath.Join(attachmentsDir, fileHeader.Filename)
		outFile, err := os.Create(outPath)
		if err != nil {
			continue
		}
		defer outFile.Close()

		_, _ = io.Copy(outFile, file)
		savedFiles = append(savedFiles, map[string]string{"id": outPath})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{"files": savedFiles})
}

// --- NDJSON Chat Streaming Handler ---

func (s *Server) handleChatStream(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Text  string   `json:"text"`
		Files []string `json:"files"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Transfer-Encoding", "chunked")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	s.mu.Lock()
	activeID := s.activeChatID
	if activeID == "" {
		activeID = "chat_" + newUUID()
		now := time.Now().UTC().Format(time.RFC3339)
		ts := fmt.Sprintf("%d", time.Now().Unix())
		s.chats[activeID] = &ChatDetail{
			ChatSummary: ChatSummary{
				ID:          activeID,
				Title:       generateTitle(req.Text),
				TitleSource: "user",
				CreatedAt:   now,
				UpdatedAt:   now,
				Timestamp:   ts,
				Model:       s.model,
			},
			Blocks: []any{},
		}
		s.activeChatID = activeID
		s.saveChats()
	}

	session, exists := s.chatSessions[activeID]
	if !exists {
		dir, _ := getWardenDir()
		memDbPath := filepath.Join(dir, "memory.db")
		memStore := memory.NewMemoryStore(memDbPath)
		memStore.Init()

		confirmMgr := agent.NewConfirmationManager()
		questionMgr := agent.NewQuestionManager()

		session = agent.NewChatSession(s.model, s.llmClient, confirmMgr, questionMgr, memStore)
		session.SessionID = activeID
		
		// If blocks are already saved for this chat, rebuild LLM history from blocks
		if chat, ok := s.chats[activeID]; ok && len(chat.Blocks) > 0 {
			session.History = rebuildHistory(chat.Blocks)
			session.TokenCount = session.EstimateTokens()
		}

		s.chatSessions[activeID] = session
	}
	s.mu.Unlock()

	// 1. Stream the title event
	titleEv := struct {
		Type   string `json:"type"`
		ChatID string `json:"chat_id"`
		Title  string `json:"title"`
	}{
		Type:   "title",
		ChatID: activeID,
		Title:  s.chats[activeID].Title,
	}
	titleData, _ := json.Marshal(titleEv)
	_, _ = w.Write(titleData)
	_, _ = w.Write([]byte("\n"))
	flusher.Flush()

	// Assemble user query, append files note if any
	text := req.Text
	if len(req.Files) > 0 {
		text += "\n\n[Attached files: " + strings.Join(req.Files, ", ") + "]"
	}

	// 2. Start agent session stream
	// Mode defaults to "ask" inside stream, unless autoMode is set.
	// For task A we default to false (ask)
	ch := session.Stream(text, false, "", "")

	// 3. Consume channel and write NDJSON chunks
	for ev := range ch {
		data, err := serializeEvent(ev)
		if err != nil {
			continue
		}
		_, _ = w.Write(data)
		_, _ = w.Write([]byte("\n"))
		flusher.Flush()
	}
}

// Helpers for serialization and UUID generation

type confirmJSON struct {
	Type       string   `json:"type"`
	ID         string   `json:"id"`
	Tool       string   `json:"tool"`
	Risk       string   `json:"risk"`
	Title      string   `json:"title"`
	Summary    string   `json:"summary"`
	Details    []string `json:"details"`
	Args       string   `json:"args"`
	Preview    string   `json:"preview"`
	DefaultVal string   `json:"default"`
}

type questionJSON struct {
	Type      string                `json:"type"`
	ID        string                `json:"id"`
	Questions []client.QuestionItem `json:"questions"`
}

func serializeEvent(ev client.Event) ([]byte, error) {
	switch e := ev.(type) {
	case client.EventWardenStart:
		return json.Marshal(map[string]string{"type": "warden_start"})
	case client.EventToken:
		return json.Marshal(map[string]string{"type": "token", "text": e.Text})
	case client.EventThink:
		return json.Marshal(map[string]string{"type": "think", "text": e.Text})
	case client.EventToolStart:
		return json.Marshal(map[string]string{"type": "tool_start", "name": e.Name, "args": e.Args})
	case client.EventTool:
		return json.Marshal(map[string]any{
			"type":   "tool",
			"name":   e.Tool.Name,
			"args":   e.Tool.Args,
			"result": e.Tool.Result,
			"diff":   e.Tool.Diff,
		})
	case client.EventConfirm:
		return json.Marshal(confirmJSON{
			Type:       "confirm",
			ID:         e.ID,
			Tool:       e.Tool,
			Risk:       e.Risk,
			Title:      e.Title,
			Summary:    e.Summary,
			Details:    e.Details,
			Args:       e.Args,
			Preview:    e.Preview,
			DefaultVal: e.DefaultVal,
		})
	case client.EventQuestion:
		return json.Marshal(questionJSON{
			Type:      "question",
			ID:        e.ID,
			Questions: e.Questions,
		})
	case client.EventDone:
		return json.Marshal(map[string]any{
			"type":        "done",
			"token_count": e.TokenCount,
			"token_limit": e.TokenLimit,
		})
	case client.EventError:
		return json.Marshal(map[string]string{"type": "error", "text": e.Text})
	default:
		return nil, fmt.Errorf("unknown event type")
	}
}

func generateTitle(text string) string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return "New Chat"
	}
	title := words[0]
	for i := 1; i < len(words) && i < 5; i++ {
		title += " " + words[i]
	}
	if len(title) > 30 {
		title = title[:30] + "..."
	}
	return title
}

func newUUID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func rebuildHistory(blocks []any) []map[string]any {
	var history []map[string]any
	for _, b := range blocks {
		bMap, ok := b.(map[string]any)
		if !ok {
			continue
		}
		kind, _ := bMap["kind"].(string)
		id, _ := bMap["id"].(string)

		switch kind {
		case "user":
			text, _ := bMap["text"].(string)
			history = append(history, map[string]any{"role": "user", "content": text})
		case "assistant":
			text, _ := bMap["text"].(string)
			history = append(history, map[string]any{"role": "assistant", "content": text})
		case "tool":
			name, _ := bMap["name"].(string)
			args, _ := bMap["args"].(string)
			result, _ := bMap["result"].(string)
			status, _ := bMap["status"].(string)

			if status == "done" {
				history = append(history, map[string]any{
					"role":    "assistant",
					"content": "",
					"tool_calls": []map[string]any{
						{
							"id":   "call_" + id,
							"type": "function",
							"function": map[string]any{
								"name":      name,
								"arguments": argsToJSON(name, args),
							},
						},
					},
				})
				history = append(history, map[string]any{
					"role":         "tool",
					"tool_call_id": "call_" + id,
					"name":         name,
					"content":      result,
				})
			}
		}
	}
	return history
}

func argsToJSON(name string, args string) string {
	if strings.HasPrefix(args, "{") {
		return args
	}
	m := make(map[string]any)
	parts := strings.Split(args, ", ")
	for _, p := range parts {
		kv := strings.SplitN(p, "=", 2)
		if len(kv) == 2 {
			m[kv[0]] = kv[1]
		}
	}
	b, _ := json.Marshal(m)
	return string(b)
}
