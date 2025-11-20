// src-tauri/src/commands/index_tts.rs

use serde::{Serialize, Deserialize};
use std::path::Path;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

#[tauri::command]
pub async fn clone_index_tts_repo(target_dir: String) -> Result<String, String> {
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
            // If it's a git repo, assume it's the correct one for now and return success.
            // Further checks (e.g., remote origin) can be added if needed.
            return Ok("SUCCESS".to_string());
        } else {
            return Err(format!("Target directory '{}' exists but is not a git repository.", target_dir));
        }
    }

    // Git clone
    let clone_output = Command::new("git")
        .args(["clone", repo_url, &target_dir])
        .output()
        .await
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;

    if !clone_output.status.success() {
        return Err(format!("Git clone failed: {}", String::from_utf8_lossy(&clone_output.stderr)));
    }

    Ok("SUCCESS".to_string())
}

#[tauri::command]
pub async fn init_git_lfs(target_dir: String) -> Result<String, String> {
    let lfs_install_output = Command::new("git")
        .arg("-C")
        .arg(&target_dir)
        .args(["lfs", "install"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute git lfs install: {}", e))?;

    if !lfs_install_output.status.success() {
        return Err(format!("Git LFS install failed: {}", String::from_utf8_lossy(&lfs_install_output.stderr)));
    }

    // After install, we should also pull the LFS files to make sure they are present
    let lfs_pull_output = Command::new("git")
        .arg("-C")
        .arg(&target_dir)
        .args(["lfs", "pull"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute git lfs pull: {}", e))?;

    if !lfs_pull_output.status.success() {
        return Err(format!("Git LFS pull failed: {}", String::from_utf8_lossy(&lfs_pull_output.stderr)));
    }


    Ok("SUCCESS".to_string())
}


#[tauri::command]
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


#[tauri::command]
pub async fn setup_index_tts_env(target_dir: String, network_environment: String) -> Result<String, String> {
    let mut command = Command::new("uv");
    command.arg("sync")
           .arg("--all-extras")
           .current_dir(&target_dir);

    if network_environment == "mainland_china" {
        command.arg("--index-url").arg("https://pypi.tuna.tsinghua.edu.cn/simple");
    }

    let output = command.output()
                      .await
                      .map_err(|e| format!("Failed to execute uv sync: {}", e))?;

    if !output.status.success() {
        return Err(format!("uv sync failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

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

#[tauri::command]
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