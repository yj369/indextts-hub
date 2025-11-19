// src-tauri/src/commands/server.rs

use serde::Serialize;
use tokio::process::{Command as TokioCommand, Child};
use std::sync::{Mutex, MutexGuard};
use tauri::{State, AppHandle, Emitter};
use tokio::io::{BufReader, AsyncBufReadExt};
use tokio::time::sleep;
use std::net::{TcpStream, SocketAddrV4, Ipv4Addr};
use std::time::Duration;

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
    Error,
}

#[tauri::command]
pub async fn start_index_tts_server(
    app_handle: AppHandle, // Add AppHandle
    repo_dir: String,
    hf_endpoint: Option<String>,
    use_fp16: bool, // Add use_fp16
    _use_deepspeed: bool, // Add use_deepspeed
    state: State<'_, ServerChildProcess>,
) -> Result<ServerStatus, String> {
    let mut guard = state.lock();
    if guard.is_some() {
        return Err("Server is already running.".to_string());
    }

    let mut command = TokioCommand::new("uv");
    command.arg("run")
           .arg("webui.py")
           .current_dir(&repo_dir)
           .stdout(std::process::Stdio::piped()) // Capture stdout
           .stderr(std::process::Stdio::piped()); // Capture stderr

    if let Some(endpoint) = hf_endpoint {
        command.env("HF_ENDPOINT", endpoint);
    }

    // Integrate use_fp16 into the command arguments
    if use_fp16 {
        // The web search indicated '--half' is used for half precision
        command.arg("--half");
    }

    // Deepspeed integration is not directly available via webui.py arguments as per investigation.
    // If future versions of webui.py support it, this section would be updated.

    let mut child = command.spawn().map_err(|e| format!("Failed to start server: {}", e))?;

    // Get stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to capture stdout".to_string())?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr".to_string())?;

    // Spawn tasks to read stdout and stderr and emit events
    tokio::spawn({
        let app_handle = app_handle.clone();
        async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                app_handle.emit("server-log-stdout", line).unwrap();
            }
        }
    });

    let app_handle_err = app_handle.clone(); // Clone for stderr task
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            app_handle_err.emit("server-log-stderr", line).unwrap();
        }
    });

    *guard = Some(child);

    Ok(ServerStatus::Running)
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
    if let Some(child) = guard.as_mut() { // Use as_mut() to allow `try_wait`
        if child.try_wait().map_err(|e| format!("Error checking child status: {}", e))?.is_none() {
            Ok(ServerStatus::Running)
        } else {
            *guard = None; // Child process has exited, clear the handle
            Ok(ServerStatus::Stopped)
        }
    } else {
        Ok(ServerStatus::Stopped)
    }
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
