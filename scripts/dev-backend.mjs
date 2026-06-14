// Dev launcher for the Python backend.
// Spawns `uv run python -m agent.server` with cwd = ./backend so the `agent`
// package resolves with the same UTF-8 environment used in bundled builds.
// uv auto-activates ./backend/.venv (created via `uv sync`).
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(scriptDir, "..", "backend");

const env = {
  ...process.env,
  PYTHONUTF8: "1",
  PYTHONIOENCODING: "utf-8",
  PYTHONUNBUFFERED: "1",
};

const child = spawn("uv", ["run", "python", "-m", "agent.server"], {
  cwd: backendDir,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

const stop = () => {
  try {
    child.kill();
  } catch {
    // already gone
  }
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);

child.on("error", (err) => {
  console.error("[dev-backend] failed to start python:", err.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
