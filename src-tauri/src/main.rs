// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine_manager;
mod commands;

use crate::commands::index_tts;
use crate::commands::install_tools;
use crate::commands::server::{self, ServerChildProcess};
use crate::commands::system_info;
use crate::commands::tool_check;
use crate::engine_manager::{EngineConfig, EngineManager, EngineStatus};
use std::env;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use tauri::State;

/// Wraps EngineManager so we can share it between Tauri commands.
struct EngineManagerState {
    inner: Mutex<EngineManager>,
}

impl EngineManagerState {
    fn new() -> Self {
        Self {
            inner: Mutex::new(EngineManager::new()),
        }
    }

    fn lock(&self) -> MutexGuard<'_, EngineManager> {
        self.inner
            .lock()
            .expect("EngineManager mutex poisoned")
    }
}

/// Ensure the packaged app sees common locations (Homebrew, /usr/local/bin, etc.)
/// even when it is launched outside of a login shell.
fn extend_system_path_with_defaults() {
    let mut combined: Vec<PathBuf> = Vec::new();

    for dir in fallback_path_entries() {
        if dir.exists() && !combined.iter().any(|existing| existing == &dir) {
            combined.push(dir);
        }
    }

    if let Some(current_path) = env::var_os("PATH") {
        for dir in env::split_paths(&current_path) {
            if !combined.iter().any(|existing| existing == &dir) {
                combined.push(dir);
            }
        }
    }

    if combined.is_empty() {
        return;
    }

    if let Ok(joined) = env::join_paths(combined) {
        env::set_var("PATH", &joined);
    }
}

fn fallback_path_entries() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = Vec::new();

    if let Some(extra_paths) = env::var_os("INDEXTTS_ADDITIONAL_PATHS") {
        dirs.extend(env::split_paths(&extra_paths));
    }

    #[cfg(target_os = "macos")]
    {
        const MAC_FALLBACKS: [&str; 8] = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        dirs.extend(MAC_FALLBACKS.iter().map(PathBuf::from));
    }

    #[cfg(target_os = "linux")]
    {
        const LINUX_FALLBACKS: [&str; 6] = [
            "/usr/local/bin",
            "/usr/local/sbin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        dirs.extend(LINUX_FALLBACKS.iter().map(PathBuf::from));
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(program_files) = env::var_os("ProgramFiles") {
            let pf = PathBuf::from(program_files);
            dirs.push(pf.join("Git").join("cmd"));
            dirs.push(pf.join("Git").join("bin"));
            dirs.push(pf.join("Git LFS"));
        }
        if let Some(program_files_x86) = env::var_os("ProgramFiles(x86)") {
            let pf = PathBuf::from(program_files_x86);
            dirs.push(pf.join("Git").join("cmd"));
            dirs.push(pf.join("Git").join("bin"));
            dirs.push(pf.join("Git LFS"));
        }
        if let Some(system_root) = env::var_os("SystemRoot") {
            let sr = PathBuf::from(system_root);
            dirs.push(sr.join("System32"));
        }
    }

    if let Some(home_dir) = env::var_os("HOME").or_else(|| env::var_os("USERPROFILE")) {
        let home = PathBuf::from(home_dir);
        #[cfg(not(target_os = "windows"))]
        {
            dirs.push(home.join(".local").join("bin"));
            dirs.push(home.join("bin"));
        }
        #[cfg(target_os = "windows")]
        {
            dirs.push(home.join("AppData").join("Local").join("Programs"));
        }
    }

    dirs
}

#[tauri::command]
fn get_engine_status(state: State<'_, EngineManagerState>) -> EngineStatus {
    state.lock().status()
}

#[tauri::command]
fn get_engine_config(state: State<'_, EngineManagerState>) -> EngineConfig {
    state.lock().config()
}

#[tauri::command]
fn update_engine_config(
    state: State<'_, EngineManagerState>,
    config: EngineConfig,
) -> EngineConfig {
    let mut manager = state.lock();
    manager.update_config(config.clone());
    config
}

#[tauri::command]
fn set_engine_status(
    state: State<'_, EngineManagerState>,
    status: EngineStatus,
) -> EngineStatus {
    let mut manager = state.lock();
    manager.set_status(status.clone());
    status
}

fn main() {
    extend_system_path_with_defaults();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(EngineManagerState::new())
        .manage(ServerChildProcess::new())
        .invoke_handler(tauri::generate_handler![
            get_engine_status,
            get_engine_config,
            update_engine_config,
            set_engine_status,
            system_info::get_system_info,
            tool_check::check_tools,
            install_tools::install_git_and_lfs,
            install_tools::install_uv,
            index_tts::clone_index_tts_repo,
            index_tts::check_index_tts_repo,
            index_tts::setup_index_tts_env,
            index_tts::install_hf_or_modelscope_tools,
            index_tts::download_index_tts_model,
            index_tts::run_gpu_check,
            server::start_index_tts_server,
            server::stop_index_tts_server,
            server::get_server_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
