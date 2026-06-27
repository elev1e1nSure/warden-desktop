# Set PowerShell as the default shell on Windows
set shell := ["powershell", "-NoProfile", "-Command"]

# Show available recipes
default:
    @just --list

# Install all frontend dependencies
install:
    pnpm install

# Run the frontend inside the Tauri dev environment
dev:
    pnpm dev:all

# Run Vite frontend dev server
dev-frontend:
    pnpm dev

# Build the React frontend
build-frontend:
    pnpm build

# Build the Tauri desktop application
build-app:
    pnpm build:app

# Run TypeScript typechecks
typecheck:
    pnpm typecheck

# Lint frontend code using Biome
lint-frontend:
    pnpm lint

# Lint code
lint: lint-frontend

# Format frontend code using Biome
format-frontend:
    pnpm format

# Format code
format: format-frontend

# Run all lints and typechecks
check: typecheck lint

# Run frontend tests
test-frontend:
    pnpm test

# Run all tests
test: test-frontend

# Clean build artifacts and temporary folders
clean:
    @if (Test-Path dist) { Remove-Item -Recurse -Force dist }
    @if (Test-Path src-tauri/target) { Remove-Item -Recurse -Force src-tauri/target }
