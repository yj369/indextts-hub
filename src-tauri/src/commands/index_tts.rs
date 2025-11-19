// src-tauri/src/commands/index_tts.rs

use serde::{Serialize, Deserialize};
use tokio::process::Command;
use std::path::Path;

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
            .map_or(false, |output| output.status.success());

        if is_git_repo {
            // If it's a git repo, assume it's the correct one for now and proceed with LFS.
            // In a more robust implementation, we might check the remote origin.
            return install_lfs_and_pull(&target_dir).await;
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

    install_lfs_and_pull(&target_dir).await
}

async fn install_lfs_and_pull(repo_dir: &str) -> Result<String, String> {
    // Git LFS install
    let lfs_install_output = Command::new("git")
        .arg("-C")
        .arg(repo_dir)
        .args(["lfs", "install"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute git lfs install: {}", e))?;

    if !lfs_install_output.status.success() {
        return Err(format!("Git LFS install failed: {}", String::from_utf8_lossy(&lfs_install_output.stderr)));
    }

    // Git LFS pull
    let lfs_pull_output = Command::new("git")
        .arg("-C")
        .arg(repo_dir)
        .args(["lfs", "pull"])
        .output()
        .await
        .map_err(|e| format!("Failed to execute git lfs pull: {}", e))?;

    if !lfs_pull_output.status.success() {
        return Err(format!("Git LFS pull failed: {}", String::from_utf8_lossy(&lfs_pull_output.stderr)));
    }

    Ok(format!("IndexTTS2 repository cloned and LFS files pulled successfully to {}", repo_dir))
}

#[tauri::command]
pub async fn setup_index_tts_env(repo_dir: String, pypi_mirror: Option<String>) -> Result<String, String> {
    let mut command = Command::new("uv");
    command.arg("sync")
           .arg("--all-extras")
           .current_dir(&repo_dir);

    if let Some(mirror) = pypi_mirror {
        command.arg("--default-index").arg(mirror);
    }

    let output = command.output()
                      .await
                      .map_err(|e| format!("Failed to execute uv sync: {}", e))?;

    if !output.status.success() {
        return Err(format!("uv sync failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(format!("IndexTTS2 environment set up successfully in {}", repo_dir))
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

#[derive(Debug, Serialize, Deserialize)]
pub enum ModelSource {
    HuggingFace,
    ModelScope,
}

#[tauri::command]
pub async fn download_index_tts_model(
    repo_dir: String,
    model_source: ModelSource,
    use_hf_mirror: bool,
    model_save_path: Option<String>,
) -> Result<String, String> {
    let mut command_args: Vec<&str> = Vec::new();
    let mut command = Command::new("uv");
    command.current_dir(&repo_dir);

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


    let output = command.output()
                      .await
                      .map_err(|e| format!("Failed to execute model download command: {}", e))?;

    if !output.status.success() {
        return Err(format!("Model download failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(format!("IndexTTS2 model downloaded successfully from {:?}", model_source))
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