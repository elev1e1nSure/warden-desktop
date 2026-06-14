// Dev launcher for the Python backend.
// Spawns `python -m agent.server` with cwd = ./backend so the `agent` package
// resolves with the same UTF-8 environment used in bundled builds.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = join(scriptDir, "..", "backend");
const python = process.platform === "win32" ? "python" : "python3";

const env = {
  ...process.env,
  PYTHONUTF8: "1",
  PYTHONIOENCODING: "utf-8",
  PYTHONUNBUFFERED: "1",
};

const child = spawn(python, ["-m", "agent.server"], {
  cwd: backendDir,
  env,
  stdio: "inherit",
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
