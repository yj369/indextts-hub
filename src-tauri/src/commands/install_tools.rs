// src-tauri/src/commands/install_tools.rs

use std::env;
use tokio::process::Command;

#[tauri::command]
pub async fn install_git_and_lfs() -> Result<String, String> {
    let os = env::consts::OS;

    match os {
        "windows" => {
            // Check for winget
            let winget_installed = Command::new("winget")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if winget_installed {
                let git_install_cmd = Command::new("winget")
                    .args(["install", "--id", "Git.Git", "-e", "--source", "winget"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute winget for Git: {}", e))?;

                if !git_install_cmd.status.success() {
                    return Err(format!("Winget Git installation failed: {}", String::from_utf8_lossy(&git_install_cmd.stderr)));
                }

                // Git LFS is usually included or installed with Git for Windows,
                // but if not, winget might have a package for it, or it needs manual handling.
                // For now, assume Git.Git handles Git LFS.
                Ok("SUCCESS".to_string())
            } else {
                Err("Winget not found. Please install Git and Git LFS manually from https://git-scm.com/download/win".to_string())
            }
        },
        "macos" => {
            // Check for Homebrew
            let brew_installed = Command::new("brew")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if brew_installed {
                let git_install_cmd = Command::new("brew")
                    .args(["install", "git", "git-lfs"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute brew for Git and Git LFS: {}", e))?;

                if !git_install_cmd.status.success() {
                    return Err(format!("Homebrew Git and Git LFS installation failed: {}", String::from_utf8_lossy(&git_install_cmd.stderr)));
                }
                Ok("SUCCESS".to_string())
            } else {
                Err("Homebrew not found. Please install Git and Git LFS manually, or install Homebrew first from https://brew.sh".to_string())
            }
        },
        _ => Err(format!("Automatic Git and Git LFS installation is not supported on {} yet. Please install manually.", os)),
    }
}

#[tauri::command]
pub async fn install_uv() -> Result<String, String> {
    let os = env::consts::OS;

    match os {
        "windows" => {
            let winget_installed = Command::new("winget")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if winget_installed {
                let uv_install_cmd = Command::new("winget")
                    .args(["install", "--id", "astral-sh.uv", "-e"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute winget for uv: {}", e))?;

                if !uv_install_cmd.status.success() {
                    return Err(format!(
                        "Winget uv installation failed: {}",
                        String::from_utf8_lossy(&uv_install_cmd.stderr)
                    ));
                }
                Ok("SUCCESS".to_string())
            } else {
                Err("Winget not found. Please install uv manually from https://docs.astral.sh/uv/install".to_string())
            }
        }
        "macos" => {
            let brew_installed = Command::new("brew")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if brew_installed {
                let uv_install_cmd = Command::new("brew")
                    .args(["install", "uv"])
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute brew for uv: {}", e))?;

                if !uv_install_cmd.status.success() {
                    return Err(format!(
                        "Homebrew uv installation failed: {}",
                        String::from_utf8_lossy(&uv_install_cmd.stderr)
                    ));
                }
                Ok("SUCCESS".to_string())
            } else {
                // Fallback to curl script for macOS if brew is not installed
                let curl_install_cmd = Command::new("sh")
                    .arg("-c")
                    .arg("curl -LsSf https://astral.sh/uv/install.sh | sh")
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute curl script for uv: {}", e))?;

                if !curl_install_cmd.status.success() {
                    return Err(format!(
                        "Curl script uv installation failed: {}",
                        String::from_utf8_lossy(&curl_install_cmd.stderr)
                    ));
                }
                Ok("SUCCESS".to_string())
            }
        }
        _ => Err(format!(
            "Automatic uv installation is not supported on {} yet. Please install manually.",
            os
        )),
    }
}

#[tauri::command]
pub async fn install_python() -> Result<String, String> {
    let os = env::consts::OS;

    match os {
        "windows" => {
            let winget_installed = Command::new("winget")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if winget_installed {
                let python_install_cmd = Command::new("winget")
                    .args(["install", "--id", "Python.Python.3.10", "-e"]) // Targeting Python 3.10
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute winget for Python: {}", e))?;

                if !python_install_cmd.status.success() {
                    return Err(format!(
                        "Winget Python installation failed: {}",
                        String::from_utf8_lossy(&python_install_cmd.stderr)
                    ));
                }
                Ok("SUCCESS".to_string())
            } else {
                Err("Winget not found. Please install Python manually from https://www.python.org/downloads/windows/".to_string())
            }
        }
        "macos" => {
            let brew_installed = Command::new("brew")
                .arg("--version")
                .output()
                .await
                .map_or(false, |output| output.status.success());

            if brew_installed {
                let python_install_cmd = Command::new("brew")
                    .args(["install", "python@3.10"]) // Targeting Python 3.10
                    .output()
                    .await
                    .map_err(|e| format!("Failed to execute brew for Python: {}", e))?;

                if !python_install_cmd.status.success() {
                    return Err(format!(
                        "Homebrew Python installation failed: {}",
                        String::from_utf8_lossy(&python_install_cmd.stderr)
                    ));
                }
                Ok("SUCCESS".to_string())
            } else {
                Err("Homebrew not found. Please install Python manually from https://www.python.org/downloads/mac-osx/".to_string())
            }
        }
        _ => Err(format!(
            "Automatic Python installation is not supported on {} yet. Please install manually.",
            os
        )),
    }
}
