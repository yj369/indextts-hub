// src-tauri/src/commands/index_tts.rs

use super::command_utils::{configure_command, new_command};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncRead, AsyncReadExt, BufReader};
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

fn repo_has_core_files(path: &Path) -> bool {
    let pyproject = path.join("pyproject.toml");
    let webui = path.join("webui.py");
    pyproject.exists() && webui.exists()
}

fn directory_is_empty(path: &Path) -> Result<bool, String> {
    match fs::read_dir(path) {
        Ok(mut entries) => Ok(entries.next().is_none()),
        Err(e) => Err(format!(
            "Failed to inspect directory '{}': {}",
            path.display(),
            e
        )),
    }
}

async fn run_command_with_streaming(
    app_handle: &AppHandle,
    step: &str,
    mut command: Command,
) -> Result<(), String> {
    configure_command(&mut command);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", step, e))?;

    let stderr_accumulator: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        spawn_stream_reader(stdout, app_handle.clone(), step.to_string(), "stdout", None);
    }

    if let Some(stderr) = child.stderr.take() {
        spawn_stream_reader(
            stderr,
            app_handle.clone(),
            step.to_string(),
            "stderr",
            Some(stderr_accumulator.clone()),
        );
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

fn spawn_stream_reader<R>(
    stream: R,
    app_handle: AppHandle,
    step_name: String,
    stream_name: &'static str,
    buffer: Option<Arc<Mutex<Vec<String>>>>,
) where
    R: AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut reader = BufReader::new(stream);
        let mut chunk = vec![0u8; 4096];
        let mut carry = String::new();

        loop {
            match reader.read(&mut chunk).await {
                Ok(0) => {
                    if !carry.is_empty() {
                        forward_line(
                            &app_handle,
                            &step_name,
                            stream_name,
                            &carry,
                            buffer.as_ref(),
                        );
                        carry.clear();
                    }
                    break;
                }
                Ok(n) => {
                    let mut text = String::from_utf8_lossy(&chunk[..n]).to_string();
                    if text.contains('\r') {
                        text = text.replace("\r\n", "\n");
                        text = text.replace('\r', "\n");
                    }
                    carry.push_str(&text);

                    while let Some(pos) = carry.find('\n') {
                        let line = carry[..pos].to_string();
                        carry.drain(..=pos);
                        forward_line(&app_handle, &step_name, stream_name, &line, buffer.as_ref());
                    }
                }
                Err(_) => break,
            }
        }
    });
}

fn forward_line(
    app_handle: &AppHandle,
    step_name: &str,
    stream_name: &str,
    line: &str,
    buffer: Option<&Arc<Mutex<Vec<String>>>>,
) {
    if let Some(buf) = buffer {
        if let Ok(mut guard) = buf.lock() {
            guard.push(line.to_string());
        }
    }
    if !line.is_empty() {
        emit_core_deploy_log(app_handle, step_name, stream_name, line);
    }
}

async fn repair_existing_repo(app_handle: &AppHandle, target_dir: &str) -> Result<(), String> {
    let mut reset_cmd = new_command("git");
    reset_cmd
        .arg("-C")
        .arg(target_dir)
        .args(["reset", "--hard", "HEAD"]);
    run_command_with_streaming(app_handle, "repair_repo_reset", reset_cmd).await?;

    let mut clean_cmd = new_command("git");
    clean_cmd.arg("-C").arg(target_dir).args(["clean", "-fdx"]);
    run_command_with_streaming(app_handle, "repair_repo_clean", clean_cmd).await?;

    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn clone_index_tts_repo(
    app_handle: AppHandle,
    target_dir: String,
) -> Result<String, String> {
    let repo_url = "https://github.com/index-tts/index-tts.git";
    let target_path = Path::new(&target_dir);

    // Check if the directory already exists
    if target_path.exists() && target_path.is_dir() {
        // If it exists, check if it's a git repository
        let is_git_repo = new_command("git")
            .arg("-C")
            .arg(&target_dir)
            .arg("rev-parse")
            .arg("--is-inside-work-tree")
            .output()
            .await
            .map_err(|e| format!("Failed to check if {} is a git repo: {}", target_dir, e))?;

        if is_git_repo.status.success() {
            if repo_has_core_files(target_path) {
                emit_core_deploy_log(
                    &app_handle,
                    "clone_repo",
                    "stdout",
                    "目标目录已存在，跳过克隆。",
                );
                return Ok("SUCCESS".to_string());
            }

            emit_core_deploy_log(
                &app_handle,
                "clone_repo",
                "stderr",
                "检测到现有仓库缺少关键文件，尝试自动恢复...",
            );

            if let Err(err) = repair_existing_repo(&app_handle, &target_dir).await {
                emit_core_deploy_log(
                    &app_handle,
                    "clone_repo",
                    "stderr",
                    &format!("自动恢复失败: {}", err),
                );
                return Err(format!(
                    "Existing repository at '{}' is missing required files and could not be repaired. Please clean the directory and retry.",
                    target_dir
                ));
            }

            if repo_has_core_files(target_path) {
                emit_core_deploy_log(
                    &app_handle,
                    "clone_repo",
                    "stdout",
                    "仓库修复完成，跳过重新克隆。",
                );
                return Ok("SUCCESS".to_string());
            }

            return Err(format!(
                "Repository at '{}' is still missing required files after repair. Please remove the folder and deploy again.",
                target_dir
            ));
        } else {
            match directory_is_empty(target_path) {
                Ok(true) => {
                    emit_core_deploy_log(
                        &app_handle,
                        "clone_repo",
                        "stdout",
                        "检测到一个空目录，自动清理后继续克隆。",
                    );
                    fs::remove_dir_all(target_path).map_err(|e| {
                        format!(
                            "Failed to reset empty target directory '{}': {}",
                            target_dir, e
                        )
                    })?;
                }
                Ok(false) => {
                    return Err(format!(
                        "Target directory '{}' exists, is not a git repository, and contains files. Please choose an empty directory or clean it before retrying.",
                        target_dir
                    ));
                }
                Err(e) => return Err(e),
            }
        }
    }

    let mut command = new_command("git");
    command.args(["clone", repo_url, &target_dir]);
    run_command_with_streaming(&app_handle, "clone_repo", command).await?;
    Ok("SUCCESS".to_string())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn init_git_lfs(app_handle: AppHandle, target_dir: String) -> Result<String, String> {
    let mut install_cmd = new_command("git");
    install_cmd
        .arg("-C")
        .arg(&target_dir)
        .args(["lfs", "install"]);
    run_command_with_streaming(&app_handle, "init_lfs", install_cmd).await?;

    let mut pull_cmd = new_command("git");
    pull_cmd.arg("-C").arg(&target_dir).args(["lfs", "pull"]);
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
pub async fn setup_index_tts_env(
    app_handle: AppHandle,
    target_dir: String,
    network_environment: String,
) -> Result<String, String> {
    let use_china_mirror = network_environment == "mainland_china";

    let mut command = new_command("uv");
    command.arg("sync").current_dir(&target_dir);

    if use_china_mirror {
        command
            .arg("--default-index")
            .arg("https://pypi.tuna.tsinghua.edu.cn/simple");
    }

    run_command_with_streaming(&app_handle, "setup_env", command).await?;

    let mut install_gradio_cmd = new_command("uv");
    install_gradio_cmd
        .arg("pip")
        .arg("install")
        .arg("gradio")
        .current_dir(&target_dir);

    if use_china_mirror {
        install_gradio_cmd
            .arg("--index-url")
            .arg("https://pypi.tuna.tsinghua.edu.cn/simple");
    }

    run_command_with_streaming(&app_handle, "install_gradio", install_gradio_cmd).await?;
    Ok("SUCCESS".to_string())
}

#[tauri::command]
pub async fn install_hf_or_modelscope_tools(
    repo_dir: String,
    tool_name: String,
) -> Result<String, String> {
    let mut command = new_command("uv");
    command
        .arg("tool")
        .arg("install")
        .arg(&tool_name)
        .current_dir(&repo_dir); // Ensure uv tools are installed within the repo's virtual environment

    let output = command
        .output()
        .await
        .map_err(|e| format!("Failed to execute uv tool install for {}: {}", tool_name, e))?;

    if !output.status.success() {
        return Err(format!(
            "uv tool install for {} failed: {}",
            tool_name,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(format!(
        "{} installed successfully using uv tool.",
        tool_name
    ))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ModelSource {
    HuggingFace,
    ModelScope,
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
    let local_dir = model_save_path.unwrap_or_else(|| "checkpoints".to_string());

    let mut command = new_command("uv");
    command.current_dir(&target_dir);

    match model_source {
        ModelSource::HuggingFace => {
            command.args(["run", "hf", "download", "IndexTeam/IndexTTS-2"]);
            command.arg("--local-dir").arg(&local_dir);

            if use_hf_mirror {
                command.env("HF_ENDPOINT", "https://hf-mirror.com");
            }
        }
        ModelSource::ModelScope => {
            command.args([
                "run",
                "modelscope",
                "download",
                "--model",
                "IndexTeam/IndexTTS-2",
            ]);
            command.arg("--local_dir").arg(&local_dir);
        }
    }

    run_command_with_streaming(&app_handle, "download_model", command).await?;
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
    let output = new_command("uv")
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
    let name = stdout
        .lines()
        .find(|line| line.contains("GPU:"))
        .and_then(|line| line.split(':').nth(1))
        .map(|s| s.trim().to_string());

    let vram_gb = stdout
        .lines()
        .find(|line| line.contains("VRAM:"))
        .and_then(|line| {
            line.split(':')
                .nth(1)
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
