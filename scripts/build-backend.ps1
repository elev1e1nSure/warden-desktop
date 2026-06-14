# Builds the Python backend into a standalone exe (PyInstaller) and
# stages it under src-tauri/binaries so `tauri build` can bundle it as a resource.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$out = Join-Path $root "src-tauri\binaries"

Push-Location $backend
try {
    uv sync --extra tools --extra build
    uv run pyinstaller --noconfirm --onefile --name warden-backend `
        --collect-all agent `
        --collect-all playwright `
        --collect-submodules openai `
        --hidden-import=aiohttp `
        --hidden-import=PIL `
        --hidden-import=pyautogui `
        --hidden-import=openai `
        --hidden-import=duckduckgo_search `
        --hidden-import=html2text `
        --hidden-import=certifi `
        run_backend.py
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $out | Out-Null
Copy-Item -Force (Join-Path $backend "dist\warden-backend.exe") (Join-Path $out "warden-backend.exe")
Write-Host "backend staged at $out\warden-backend.exe"
