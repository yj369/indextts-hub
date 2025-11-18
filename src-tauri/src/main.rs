// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod engine_manager;

use crate::engine_manager::{EngineConfig, EngineManager, EngineStatus};
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
        .invoke_handler(tauri::generate_handler![
            get_engine_status,
            get_engine_config,
            update_engine_config,
            set_engine_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
