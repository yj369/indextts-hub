// src-tauri/src/commands/server.rs

use serde::{Serialize, Deserialize};
use tokio::process::{Command as TokioCommand, Child};
use std::sync::{Mutex, MutexGuard};
use tauri::{State, AppHandle, Emitter};
use tokio::io::{BufReader, AsyncBufReadExt};
use tokio::time::sleep;
use std::net::{TcpStream, SocketAddrV4, Ipv4Addr};
use std::time::Duration;
use std::path::Path;

// Define a struct to hold the child process, to be managed by Tauri State
pub struct ServerChildProcess(Mutex<Option<Child>>);

impl ServerChildProcess {
    pub fn new() -> Self {
        ServerChildProcess(Mutex::new(None))
    }

    pub fn lock(&self) -> MutexGuard<'_, Option<Child>> {
        self.0.lock().expect("Server child process mutex poisoned")
    }
}

#[derive(Debug, Serialize, Clone, Copy)] // Add Clone, Copy for convenience
pub enum ServerStatus {
    Running,
    Stopped,
    Starting,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn start_index_tts_server(
    app_handle: AppHandle,
    target_dir: String,
    host: String,
    port: u16,
    device: String,
    precision: Option<String>,
    state: State<'_, ServerChildProcess>,
) -> Result<ServerStatus, String> {
    let mut guard = state.lock();
    if guard.is_some() {
        return Err("Server is already running.".to_string());
    }

    let repo_path = Path::new(&target_dir);
    if !repo_path.exists() {
        return Err(format!("Target directory does not exist: {}", target_dir));
    }
    let app_entry = repo_path.join("webui.py");
    if !app_entry.exists() {
        return Err(format!(
            "webui.py not found in {}. Please complete the deployment first.",
            repo_path.display()
        ));
    }

    let mut command = TokioCommand::new("uv");
    command.arg("run")
           .arg("webui.py")
           .arg("--host").arg(&host)
           .arg("--port").arg(port.to_string())
           .current_dir(&target_dir)
           .stdout(std::process::Stdio::piped())
           .stderr(std::process::Stdio::piped());

    if let Some(p) = precision {
        if p == "fp16" {
            command.arg("--fp16");
        }
    }

    if device == "cuda" {
        command.arg("--cuda_kernel");
    }

    // Pass HF_ENDPOINT if it's set in the environment or needed
    // For now, let's assume it's handled by setup_index_tts_env or download_index_tts_model if required.
    // If a direct HF_ENDPOINT is needed here, it should be passed from the frontend.

    let mut child = command.spawn().map_err(|e| format!("Failed to start server: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout".to_string())?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr".to_string())?;

    tokio::spawn({
        let app_handle = app_handle.clone();
        async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle.emit("server-log-stdout", line).unwrap();
            }
        }
    });

    let app_handle_err = app_handle.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_handle_err.emit("server-log-stderr", line).unwrap();
        }
    });

    *guard = Some(child);

    Ok(ServerStatus::Starting)
}

#[tauri::command]
pub async fn stop_index_tts_server(state: State<'_, ServerChildProcess>) -> Result<ServerStatus, String> {
    let child = {
        let mut guard = state.lock();
        guard.take()
    };

    if let Some(mut child_process) = child {
        if let Err(e) = child_process.kill().await {
            let mut guard = state.lock();
            *guard = Some(child_process);
            return Err(format!("Failed to stop server: {}", e));
        }
        let _ = child_process.wait().await;
    }

    ensure_port_closed(7860).await?;

    Ok(ServerStatus::Stopped)
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, ServerChildProcess>) -> Result<ServerStatus, String> {
    let mut guard = state.lock();
    if let Some(child) = guard.as_mut() {
        match child.try_wait().map_err(|e| format!("Error checking child status: {}", e))? {
            Some(_status) => {
                *guard = None;
                Ok(ServerStatus::Stopped)
            }
            None => {
                Ok(ServerStatus::Running)
            }
        }
    } else {
        Ok(ServerStatus::Stopped)
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RepoUpdateInfo {
    pub has_update: bool,
    pub local_hash: String,
    pub remote_hash: String,
    pub message: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn check_repo_update(target_dir: String) -> Result<RepoUpdateInfo, String> {
    let repo_path = Path::new(&target_dir);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("Repository directory does not exist.".to_string());
    }

    // Fetch latest changes from remote
    let fetch_output = TokioCommand::new("git")
        .arg("-C")
        .arg(&target_dir)
        .arg("fetch")
        .output()
        .await
        .map_err(|e| format!("Failed to execute git fetch: {}", e))?;

    if !fetch_output.status.success() {
        return Err(format!("Git fetch failed: {}", String::from_utf8_lossy(&fetch_output.stderr)));
    }

    // Get local HEAD commit hash
    let local_hash_output = TokioCommand::new("git")
        .arg("-C")
        .arg(&target_dir)
        .args(["log", "-n", "1", "--pretty=format:%H"])
        .output()
        .await
        .map_err(|e| format!("Failed to get local hash: {}", e))?;

    if !local_hash_output.status.success() {
        return Err(format!("Failed to get local hash: {}", String::from_utf8_lossy(&local_hash_output.stderr)));
    }
    let local_hash = String::from_utf8_lossy(&local_hash_output.stdout).trim().to_string();

    // Get remote HEAD commit hash for the current branch
    let remote_hash_output = TokioCommand::new("git")
        .arg("-C")
        .arg(&target_dir)
        .args(["log", "-n", "1", "--pretty=format:%H", "origin/main"]) // Assuming 'main' branch
        .output()
        .await
        .map_err(|e| format!("Failed to get remote hash: {}", e))?;

    if !remote_hash_output.status.success() {
        return Err(format!("Failed to get remote hash: {}", String::from_utf8_lossy(&remote_hash_output.stderr)));
    }
    let remote_hash = String::from_utf8_lossy(&remote_hash_output.stdout).trim().to_string();

    let has_update = local_hash != remote_hash;
    let message = if has_update {
        "New version available.".to_string()
    } else {
        "Already up to date.".to_string()
    };

    Ok(RepoUpdateInfo {
        has_update,
        local_hash,
        remote_hash,
        message,
    })
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pull_repo(target_dir: String) -> Result<String, String> {
    let repo_path = Path::new(&target_dir);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Err("Repository directory does not exist.".to_string());
    }

    let pull_output = TokioCommand::new("git")
        .arg("-C")
        .arg(&target_dir)
        .arg("pull")
        .output()
        .await
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if !pull_output.status.success() {
        return Err(format!("Git pull failed: {}", String::from_utf8_lossy(&pull_output.stderr)));
    }

    Ok("SUCCESS".to_string())
}


fn port_is_reachable(port: u16) -> bool {
    let addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, port);
    TcpStream::connect_timeout(&addr.into(), Duration::from_millis(200)).is_ok()
}

async fn ensure_port_closed(port: u16) -> Result<(), String> {
    const MAX_ATTEMPTS: u8 = 5;
    for _ in 0..MAX_ATTEMPTS {
        if !port_is_reachable(port) {
            return Ok(());
        }

        force_kill_port(port).await?;
        sleep(Duration::from_millis(300)).await;
    }

    if port_is_reachable(port) {
        Err(format!(
            "Port {} is still serving requests. Please close IndexTTS2 manually.",
            port
        ))
    } else {
        Ok(())
    }
}

#[cfg(unix)]
async fn force_kill_port(port: u16) -> Result<(), String> {
    let port_spec = format!(":{}", port);
    let output = TokioCommand::new("lsof")
        .args(["-ti", &port_spec])
        .output()
        .await
        .map_err(|e| format!("Failed to inspect active connections on port {}: {}", port, e))?;

    if output.stdout.is_empty() {
        return Ok(());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for pid in stdout.lines().map(|line| line.trim()).filter(|line| !line.is_empty()) {
        let kill_output = TokioCommand::new("kill")
            .args(["-9", pid])
            .output()
            .await
            .map_err(|e| format!("Failed to kill PID {} on port {}: {}", pid, port, e))?;

        if !kill_output.status.success() {
            return Err(format!(
                "kill -9 {} exited with {} for port {}: {}",
                pid,
                kill_output.status,
                port,
                String::from_utf8_lossy(&kill_output.stderr)
            ));
        }
    }

    Ok(())
}

#[cfg(windows)]
async fn force_kill_port(port: u16) -> Result<(), String> {
    let script = format!(
        "Get-NetTCPConnection -LocalPort {} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess",
        port
    );
    let output = TokioCommand::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .output()
        .await
        .map_err(|e| format!("Failed to inspect active connections on port {}: {}", port, e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut killed_any = false;
    for pid in stdout.lines().map(|line| line.trim()).filter(|line| !line.is_empty()) {
        killed_any = true;
        let kill_output = TokioCommand::new("taskkill")
            .args(["/PID", pid, "/F"])
            .output()
            .await
            .map_err(|e| format!("Failed to kill PID {} on port {}: {}", pid, port, e))?;

        if !kill_output.status.success() {
            return Err(format!(
                "taskkill failed for PID {} on port {}: {}",
                pid,
                port,
                String::from_utf8_lossy(&kill_output.stderr)
            ));
        }
    }

    if !killed_any && stdout.trim().is_empty() {
        return Ok(());
    }

    Ok(())
}

#[cfg(not(any(unix, windows)))]
async fn force_kill_port(_port: u16) -> Result<(), String> {
    Err("Force killing ports is not supported on this platform.".to_string())
}
