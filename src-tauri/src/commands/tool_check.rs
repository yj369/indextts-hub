// src-tauri/src/commands/tool_check.rs

use serde::{Serialize, Deserialize};
use tokio::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolStatus {
    pub git_installed: bool,
    pub git_lfs_installed: bool,
    pub uv_installed: bool,
}

/// Checks if a command exists and runs successfully with a --version flag.
async fn check_command(cmd_name: &str, version_arg: &str) -> bool {
    let output = Command::new(cmd_name)
        .arg(version_arg)
        .output()
        .await;

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

    Ok(ToolStatus {
        git_installed,
        git_lfs_installed,
        uv_installed,
    })
}