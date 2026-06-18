use std::io::Write;
use std::net::TcpStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::Manager;

const BACKEND_PORT: u16 = 8765;

// Windows Job Object wrapper. When this handle is dropped — for any reason,
// including a crash or force-kill — the OS automatically terminates every
// process assigned to the job. No orphaned backend processes.
#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    pub struct JobObject(HANDLE);

    unsafe impl Send for JobObject {}
    unsafe impl Sync for JobObject {}

    impl Drop for JobObject {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.0);
            }
        }
    }

    pub fn create_and_assign(child: &Child) -> Option<JobObject> {
        unsafe {
            let job = CreateJobObjectW(None, None).ok()?;

            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                std::ptr::addr_of!(info).cast(),
                std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            )
            .is_err()
            {
                let _ = CloseHandle(job);
                return None;
            }

            let proc_handle = HANDLE(child.as_raw_handle());
            if AssignProcessToJobObject(job, proc_handle).is_err() {
                let _ = CloseHandle(job);
                return None;
            }

            Some(JobObject(job))
        }
    }
}

struct SpawnedBackend {
    child: Child,
    // Kept alive so the job handle stays open until this struct is dropped.
    #[cfg(windows)]
    _job: Option<job::JobObject>,
}

struct BackendProc(Mutex<Option<SpawnedBackend>>);

fn backend_running() -> bool {
    let addr = format!("127.0.0.1:{BACKEND_PORT}");
    match addr.parse() {
        Ok(socket) => TcpStream::connect_timeout(&socket, Duration::from_millis(300)).is_ok(),
        Err(_) => false,
    }
}

/// Ask the backend to shut down gracefully, then wait for it to exit.
/// The Job Object provides a hard guarantee if this path fails for any reason.
fn stop_backend(backend: &mut SpawnedBackend) {
    let child = &mut backend.child;

    let token = dirs::data_local_dir()
        .map(|d| d.join("warden").join(".token"))
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_default();
    let token = token.trim();

    let request = if token.is_empty() {
        format!(
            "POST /shutdown HTTP/1.0\r\nHost: 127.0.0.1:{BACKEND_PORT}\r\nContent-Length: 0\r\n\r\n"
        )
    } else {
        format!(
            "POST /shutdown HTTP/1.0\r\nHost: 127.0.0.1:{BACKEND_PORT}\r\nX-Warden-Token: {token}\r\nContent-Length: 0\r\n\r\n"
        )
    };

    if let Ok(mut stream) = TcpStream::connect(format!("127.0.0.1:{BACKEND_PORT}")) {
        let _ = stream.set_write_timeout(Some(Duration::from_millis(300)));
        let _ = stream.write_all(request.as_bytes());
    }

    for _ in 0..20 {
        std::thread::sleep(Duration::from_millis(100));
        if let Ok(Some(_)) = child.try_wait() {
            return;
        }
    }

    let _ = child.kill();
    let _ = child.wait();
}

fn spawn_backend(app: &tauri::AppHandle) -> Option<SpawnedBackend> {
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

    let child = cmd.spawn().ok()?;

    #[cfg(windows)]
    let _job = job::create_and_assign(&child);

    Some(SpawnedBackend {
        child,
        #[cfg(windows)]
        _job,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(BackendProc(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_backend_token])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(backend) = spawn_backend(&handle) {
                *app.state::<BackendProc>().0.lock().unwrap() = Some(backend);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(mut backend) = app.state::<BackendProc>().0.lock().unwrap().take() {
                    stop_backend(&mut backend);
                }
            }
        });
}

#[tauri::command]
async fn get_backend_token() -> Result<String, String> {
    let path = dirs::data_local_dir()
        .ok_or("LOCALAPPDATA not found")?
        .join("warden")
        .join(".token");
    std::fs::read_to_string(&path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("failed to read token: {e}"))
}
