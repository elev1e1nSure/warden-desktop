# Set PowerShell as the default shell on Windows
set shell := ["powershell", "-NoProfile", "-Command"]

# Show available recipes
default:
    @just --list

# Install all frontend and backend dependencies
install:
    pnpm install
    cd backend; uv sync --extra tools && uv run playwright install chromium

# Run the complete development environment (frontend, backend, and Tauri dev window)
dev:
    pnpm dev:all

# Run Vite frontend dev server
dev-frontend:
    pnpm dev

# Run Python backend dev server
dev-backend:
    pnpm dev:backend

# Build the React frontend
build-frontend:
    pnpm build

# Build the Python backend executable (PyInstaller)
build-backend:
    pnpm build:backend

# Build the Tauri desktop application (includes backend build)
build-app:
    pnpm build:app

# Run TypeScript typechecks
typecheck:
    pnpm typecheck

# Lint frontend code using Biome
lint-frontend:
    pnpm lint

# Lint backend code using Ruff
lint-backend:
    cd backend; uv run ruff check .

# Lint both frontend and backend code
lint: lint-frontend lint-backend

# Format frontend code using Biome
format-frontend:
    pnpm format

# Format backend code using Ruff
format-backend:
    cd backend; uv run ruff format .

# Format both frontend and backend code
format: format-frontend format-backend

# Run all frontend and backend lints and typechecks
check: typecheck lint

# Run frontend tests
test-frontend:
    pnpm test

# Run backend tests
test-backend:
    cd backend; uv run pytest

# Run all frontend and backend tests
test: test-frontend test-backend

# Clean build artifacts and temporary folders
clean:
    @if (Test-Path dist) { Remove-Item -Recurse -Force dist }
    @if (Test-Path src-tauri/target) { Remove-Item -Recurse -Force src-tauri/target }
    @if (Test-Path backend/dist) { Remove-Item -Recurse -Force backend/dist }
    @if (Test-Path backend/build) { Remove-Item -Recurse -Force backend/build }
    @if (Test-Path backend/.pytest_cache) { Remove-Item -Recurse -Force backend/.pytest_cache }
    @if (Test-Path backend/.ruff_cache) { Remove-Item -Recurse -Force backend/.ruff_cache }
    @if (Test-Path backend/htmlcov) { Remove-Item -Recurse -Force backend/htmlcov }
    @if (Test-Path backend/.coverage) { Remove-Item -Force backend/.coverage }
    @if (Test-Path backend/coverage.json) { Remove-Item -Force backend/coverage.json }
