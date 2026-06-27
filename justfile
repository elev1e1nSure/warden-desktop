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

# Run Go backend dev server
dev-backend:
    pnpm dev:backend

# Build the React frontend
build-frontend:
    pnpm build

# Build the Go backend executable
build-backend:
    pnpm build:backend

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

# Run Go backend tests
test-backend:
    go test ./agent/... ./internal/... ./cmd/...

# Run all tests
test: test-frontend test-backend

# Print the current program version (from git tag)
version:
    @$tag = git describe --tags --abbrev=0 2>$$null; if ($tag) { $tag.TrimStart("v") } else { "0.0.0" }

# Set version in package.json, Cargo.toml and tauri.conf.json from git tag
set-version:
    $tag = git describe --tags --abbrev=0 2>$$null; if (-not $tag) { Write-Error "no git tag found"; exit 1 }; $ver = $tag.TrimStart("v"); Write-Host "version: $ver"; (Get-Content package.json) -replace '"version":\s*"[^"]*"', "`"version`": `"$ver`"" | Set-Content package.json -Encoding utf8; (Get-Content src-tauri/tauri.conf.json) -replace '"version":\s*"[^"]*"', "`"version`": `"$ver`"" | Set-Content src-tauri/tauri.conf.json -Encoding utf8; (Get-Content src-tauri/Cargo.toml) -replace '^version\s*=\s*"[^"]*"', "version = `"$ver`"" | Set-Content src-tauri/Cargo.toml -Encoding utf8

# Clean build artifacts and temporary folders
clean:
    @if (Test-Path dist) { Remove-Item -Recurse -Force dist }
    @if (Test-Path src-tauri/target) { Remove-Item -Recurse -Force src-tauri/target }
    @if (Test-Path src-tauri/binaries/warden-backend.exe) { Remove-Item -Force src-tauri/binaries/warden-backend.exe }
