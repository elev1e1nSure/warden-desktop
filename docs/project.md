# Project Overview

Warden Desktop is a desktop shell for the Warden agent. The application provides a graphical user interface to converse with the agent, choose LLM models, manage chat sessions, confirm actions, and view available skills.

The project currently integrates several components:

- A desktop UI built with React;
- A Tauri application wrapping the UI inside a native desktop window shell;
- A Python backend in `backend/` responsible for the chat API, streaming, tools, confirmations, memory, and skills.

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

## Scope of this Repository

- The visual desktop shell for Warden.
- Integration with the backend running on `http://localhost:8765`.
- Frontend compilation via Vite.
- Desktop packaging via Tauri.
- Scripts for running and compiling the Python backend.

## Backend

The `backend/` folder contains the agent runtime:

- `backend/agent/` — Python backend server and logic;
- `backend/pyproject.toml` — Python dependencies (managed with `uv`);
- `backend/run_backend.py` — entry point script for PyInstaller;
- `backend/.warden/skills/` — project skills.

The desktop UI is the sole frontend for the Python backend (Go CLI was removed in an earlier release).
