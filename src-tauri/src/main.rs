// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine_manager;
mod commands;

use crate::engine_manager::{EngineConfig, EngineManager, EngineStatus};
use crate::commands::system_info;
use crate::commands::tool_check;
use crate::commands::install_tools;
use crate::commands::index_tts;
use crate::commands::server::{self, ServerChildProcess};
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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
