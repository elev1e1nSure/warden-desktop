# Project Overview

Warden Desktop is a desktop shell for the Warden agent. The application provides a graphical user interface to converse with the agent, choose LLM models, manage chat sessions, confirm actions, and view available skills.

The project currently integrates several components:

- A desktop UI built with React;
- A Tauri application wrapping the UI inside a native desktop window shell;
- A Go backend in `agent/` and `cmd/warden-backend/` responsible for the chat API, streaming, tools, confirmations, memory, and skills.

## Core Scenarios

- Connect a model via the UI.
- Select a model from the list provided by the backend.
- Create or select a chat session.
- Send a message to the agent.
- Receive streaming responses and tool execution events.
- Confirm risky actions via a confirmation modal.
- Answer clarifying questions from the agent.
- View and enable skills.
- Control the execution mode (Ask vs. Auto).
- Upload files to attach to messages.
- Configure permission levels for tool categories.
- Enable and manage long-term memory.
- Compact chat context to reduce token usage.

## Scope of this Repository

- The visual desktop shell for Warden.
- Integration with the backend running on `http://localhost:8765`.
- Frontend compilation via Vite.
- Desktop packaging via Tauri.
- Scripts for running and compiling the Go backend.

## Backend

The `agent/` and `cmd/warden-backend/` directories contain the agent runtime:

- `agent/` — Go agent runtime: chat sessions, LLM client, tool execution, memory, safety policies, skills;
- `agent/tools/` — individual tool implementations;
- `agent/memory/` — long-term memory (aggregator, extractor, store);
- `agent/safety/` — safety policies for filesystem, PowerShell, and capabilities;
- `cmd/warden-backend/main.go` — entry point that starts the HTTP server;
- `internal/` — shared packages (client DTOs, encryption helpers);
- `.warden/skills/` — project skills at repository root.

The desktop UI is the sole frontend for the Go backend.