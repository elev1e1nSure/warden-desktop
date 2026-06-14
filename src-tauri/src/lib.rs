use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::Manager;

const BACKEND_PORT: u16 = 8765;

/// Holds the spawned backend process so we can kill it on exit.
struct BackendProc(Mutex<Option<Child>>);

/// True when something is already listening on the backend port (dev backend
/// started via `pnpm dev:all`, or another warden instance).
fn backend_running() -> bool {
    let addr = format!("127.0.0.1:{BACKEND_PORT}");
    match addr.parse() {
        Ok(socket) => TcpStream::connect_timeout(&socket, Duration::from_millis(300)).is_ok(),
        Err(_) => false,
    }
}

/// Locate and start the bundled `warden-backend.exe`. Returns None in dev (no
/// bundled exe) or when the backend is already running.
fn spawn_backend(app: &tauri::AppHandle) -> Option<Child> {
    if backend_running() {
        return None;
    }

    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(res_dir) = app.path().resource_dir() {
        candidates.push(res_dir.join("warden-backend.exe"));
        candidates.push(res_dir.join("binaries").join("warden-backend.exe"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("warden-backend.exe"));
        }
    }

    let exe = candidates.into_iter().find(|p| p.exists())?;
    let dir = exe.parent()?.to_path_buf();

    let mut cmd = Command::new(&exe);
    cmd.current_dir(&dir);
    cmd.env("PYTHONUTF8", "1");
    cmd.env("PYTHONIOENCODING", "utf-8");
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    cmd.spawn().ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BackendProc(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(child) = spawn_backend(&handle) {
                *app.state::<BackendProc>().0.lock().unwrap() = Some(child);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(mut child) = app.state::<BackendProc>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
