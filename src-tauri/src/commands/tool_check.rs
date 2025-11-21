// src-tauri/src/commands/tool_check.rs

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolStatus {
    pub git_installed: bool,
    pub git_lfs_installed: bool,
    pub python_installed: bool,
    pub uv_installed: bool,
    pub cuda_toolkit_installed: bool,
}

/// Checks if a command exists and runs successfully with a --version flag.
async fn check_command(cmd_name: &str, version_arg: &str) -> bool {
    let output = Command::new(cmd_name).arg(version_arg).output().await;

    match output {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn check_tools() -> Result<ToolStatus, String> {
    let git_installed = check_command("git", "--version").await;
    let git_lfs_installed = check_command("git-lfs", "version").await;
    let uv_installed = check_command("uv", "--version").await;

    // Check for Python
    let python_installed =
        check_command("python", "--version").await || check_command("python3", "--version").await;

    // Check for CUDA Toolkit (nvcc)
    let cuda_toolkit_installed = check_command("nvcc", "--version").await;

    Ok(ToolStatus {
        git_installed,
        git_lfs_installed,
        python_installed,
        uv_installed,
        cuda_toolkit_installed,
    })
}
