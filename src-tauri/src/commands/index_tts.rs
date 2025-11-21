// src-tauri/src/commands/index_tts.rs

use serde::{Serialize, Deserialize};
use std::path::Path;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

const CORE_DEPLOY_EVENT: &str = "core-deploy-log";

#[derive(Debug, Serialize, Clone)]
pub struct CoreDeployLogEvent {
    pub step: String,
    pub stream: String,
    pub line: String,
}

fn emit_core_deploy_log(app_handle: &AppHandle, step: &str, stream: &str, line: &str) {
    let payload = CoreDeployLogEvent {
        step: step.to_string(),
        stream: stream.to_string(),
        line: line.to_string(),
    };
    let _ = app_handle.emit(CORE_DEPLOY_EVENT, payload);
}

async fn run_command_with_streaming(
    app_handle: &AppHandle,
    step: &str,
    mut command: Command,
) -> Result<(), String> {
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", step, e))?;

    let stderr_accumulator: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        let handle = app_handle.clone();
        let step_name = step.to_string();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                emit_core_deploy_log(&handle, &step_name, "stdout", &line);
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let handle = app_handle.clone();
        let step_name = step.to_string();
        let buffer = stderr_accumulator.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                if let Ok(mut guard) = buffer.lock() {
                    guard.push(line.clone());
                }
                emit_core_deploy_log(&handle, &step_name, "stderr", &line);
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for {}: {}", step, e))?;

    if !status.success() {
        let stderr_output = stderr_accumulator
            .lock()
            .map(|buf| buf.join("\n"))
            .unwrap_or_else(|_| "command failed".to_string());
        return Err(format!("{} failed: {}", step, stderr_output));
    }

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clone_index_tts_repo(app_handle: AppHandle, target_dir: String) -> Result<String, String> {
    let repo_url = "https://github.com/index-tts/index-tts.git";
    let target_path = Path::new(&target_dir);

    // Check if the directory already exists
    if target_path.exists() && target_path.is_dir() {
        // If it exists, check if it's a git repository
        let is_git_repo = Command::new("git")
            .arg("-C")
            .arg(&target_dir)
            .arg("rev-parse")
            .arg("--is-inside-work-tree")
            .output()
            .await
            .map_err(|e| format!("Failed to check if {} is a git repo: {}", target_dir, e))?;

        if is_git_repo.status.success() {
            emit_core_deploy_log(&app_handle, "clone_repo", "stdout", "目标目录已存在，跳过克隆。");
            return Ok("SUCCESS".to_string());
        } else {
            return Err(format!("Target directory '{}' exists but is not a git repository.", target_dir));
        }
    }

    let mut command = Command::new("git");
    command.args(["clone", repo_url, &target_dir]);
    run_command_with_streaming(&app_handle, "clone_repo", command).await?;
    Ok("SUCCESS".to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn init_git_lfs(app_handle: AppHandle, target_dir: String) -> Result<String, String> {
    let mut install_cmd = Command::new("git");
    install_cmd
        .arg("-C")
        .arg(&target_dir)
        .args(["lfs", "install"]);
    run_command_with_streaming(&app_handle, "init_lfs", install_cmd).await?;

    let mut pull_cmd = Command::new("git");
    pull_cmd
        .arg("-C")
        .arg(&target_dir)
        .args(["lfs", "pull"]);
    run_command_with_streaming(&app_handle, "init_lfs", pull_cmd).await?;

    Ok("SUCCESS".to_string())
}


#[tauri::command(rename_all = "snake_case")]
pub fn check_index_tts_repo(repo_dir: Option<String>) -> Result<bool, String> {
    let normalized = match repo_dir {
        Some(path) => path.trim().to_string(),
        None => return Ok(false),
    };

    if normalized.is_empty() {
        return Ok(false);
    }

    let repo_path = PathBuf::from(&normalized);
    if !repo_path.exists() || !repo_path.is_dir() {
        return Ok(false);
    }

    let git_dir = repo_path.join(".git");
    if !git_dir.exists() || !git_dir.is_dir() {
        return Ok(false);
    }

    Ok(true)
}


#[tauri::command(rename_all = "snake_case")]
pub async fn setup_index_tts_env(app_handle: AppHandle, target_dir: String, network_environment: String) -> Result<String, String> {
    let mut command = Command::new("uv");
    command
        .arg("sync")
        .arg("--all-extras")
        .current_dir(&target_dir);

    if network_environment == "mainland_china" {
        command
            .arg("--default-index")
            .arg("https://pypi.tuna.tsinghua.edu.cn/simple");
    }

    run_command_with_streaming(&app_handle, "setup_env", command).await?;
    Ok("SUCCESS".to_string())
}

#[tauri::command]
pub async fn install_hf_or_modelscope_tools(repo_dir: String, tool_name: String) -> Result<String, String> {
    let mut command = Command::new("uv");
    command.arg("tool")
           .arg("install")
           .arg(&tool_name)
           .current_dir(&repo_dir); // Ensure uv tools are installed within the repo's virtual environment

    let output = command.output()
                      .await
                      .map_err(|e| format!("Failed to execute uv tool install for {}: {}", tool_name, e))?;

    if !output.status.success() {
        return Err(format!("uv tool install for {} failed: {}", tool_name, String::from_utf8_lossy(&output.stderr)));
    }

    Ok(format!("{} installed successfully using uv tool.", tool_name))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ModelSource {
    HuggingFace,
    ModelScope,
}

#[derive(Debug, Serialize)]
pub struct ModelDownloadLogEvent {
    pub stream: String,
    pub line: String,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn download_index_tts_model(
    app_handle: AppHandle,
    target_dir: String,
    network_environment: String,
    model_save_path: Option<String>,
) -> Result<String, String> {
    let model_source = if network_environment == "mainland_china" {
        ModelSource::ModelScope
    } else {
        ModelSource::HuggingFace
    };

    let use_hf_mirror = network_environment == "mainland_china";


    let mut command_args: Vec<&str> = Vec::new();
    let mut command = Command::new("uv");
    command.current_dir(&target_dir);

    match model_source {
        ModelSource::HuggingFace => {
            command_args.extend_from_slice(&["run", "hf"]);
            command_args.extend_from_slice(&["download", "IndexTeam/IndexTTS-2"]);
            if let Some(path) = &model_save_path {
                command_args.extend_from_slice(&["--local-dir", path]);
            } else {
                command_args.extend_from_slice(&["--local-dir", "checkpoints"]);
            }

            if use_hf_mirror {
                command.env("HF_ENDPOINT", "https://hf-mirror.com");
            }
        },
        ModelSource::ModelScope => {
            command_args.extend_from_slice(&["run", "modelscope"]);
            command_args.extend_from_slice(&["download", "--model", "IndexTeam/IndexTTS-2"]);
            if let Some(path) = &model_save_path {
                command_args.extend_from_slice(&["--local_dir", path]);
            } else {
                command_args.extend_from_slice(&["--local_dir", "checkpoints"]);
            }
        },
    }
    command.args(&command_args);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to execute model download command: {}", e))?;

    let stderr_lines: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    const EVENT_NAME: &str = "model-download-log";

    if let Some(stdout) = child.stdout.take() {
        let handle_clone = app_handle.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let payload = ModelDownloadLogEvent {
                    stream: "stdout".to_string(),
                    line,
                };
                let _ = handle_clone.emit(EVENT_NAME, &payload);
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let handle_clone = app_handle.clone();
        let stderr_accumulator = stderr_lines.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                {
                    let mut buffer = stderr_accumulator
                        .lock()
                        .expect("stderr accumulator poisoned");
                    buffer.push(line.clone());
                }

                let payload = ModelDownloadLogEvent {
                    stream: "stderr".to_string(),
                    line,
                };
                let _ = handle_clone.emit(EVENT_NAME, &payload);
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("Failed to wait for model download command: {}", e))?;

    if !status.success() {
        let stderr_output = {
            let buffer = stderr_lines
                .lock()
                .expect("stderr accumulator poisoned");
            buffer.join("\n")
        };

        if stderr_output.is_empty() {
            return Err("Model download failed with no additional output. Please check the logs.".to_string());
        } else {
            return Err(format!("Model download failed: {}", stderr_output));
        }
    }

    Ok("SUCCESS".to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GpuInfo {
    pub has_cuda: bool,
    pub name: Option<String>,
    pub vram_gb: Option<f64>,
    pub recommended_fp16: bool, // Based on some criteria, e.g., VRAM > 8GB
}

#[tauri::command]
pub async fn run_gpu_check(repo_dir: String) -> Result<GpuInfo, String> {
    let output = Command::new("uv")
        .args(["run", "tools/gpu_check.py"])
        .current_dir(&repo_dir)
        .output()
        .await
        .map_err(|e| format!("Failed to execute uv run tools/gpu_check.py: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() {
        return Err(format!("GPU check script failed: {} {}", stdout, stderr));
    }

    // Example parsing (you might need to adjust based on actual script output)
    let has_cuda = stdout.contains("torch.cuda.is_available(): True");
    let name = stdout.lines()
                     .find(|line| line.contains("GPU:"))
                     .and_then(|line| line.split(':').nth(1))
                     .map(|s| s.trim().to_string());

    let vram_gb = stdout.lines()
                        .find(|line| line.contains("VRAM:"))
                        .and_then(|line| {
                            line.split(':').nth(1)
                                .and_then(|s| s.trim().split_whitespace().next())
                                .and_then(|s| s.parse::<f64>().ok())
                        });

    // Simple recommendation for FP16: if VRAM is detected and > 8GB
    let recommended_fp16 = vram_gb.map_or(false, |vram| vram > 8.0);

    Ok(GpuInfo {
        has_cuda,
        name,
        vram_gb,
        recommended_fp16,
    })
}
