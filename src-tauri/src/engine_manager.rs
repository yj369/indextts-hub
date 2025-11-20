// src-tauri/src/engine_manager.rs

use std::path::PathBuf;
use serde::{Serialize, Deserialize};

// Engine 运行模式 (Gpu / Cpu / Mps)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum RunMode {
    Gpu,
    Cpu,
    Mps, // 针对 Apple Silicon
}

// Engine 配置，对应 FR-ENG-01
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EngineConfig {
    pub install_dir: PathBuf,
    pub model_dir: PathBuf,
    pub run_mode: RunMode,
}

// Engine 状态
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum EngineStatus {
    Stopped,
    Starting,
    Running,
    Error(String),
}

// EngineManager 状态存储结构体
pub struct EngineManager {
    config: EngineConfig,
    status: EngineStatus,
    // 存储 IndexTTS2 子进程的句柄，用于启动/停止控制 (FR-ENG-02, FR-ENG-03)
    #[allow(dead_code)]
    process_handle: Option<tokio::process::Child>,
}

impl EngineManager {
    pub fn new() -> Self {
        // 实际应用中，这里应该从 config_store 加载上次的配置
        Self {
            config: EngineConfig {
                // 默认值，需要用户在 UI 中配置
                install_dir: PathBuf::from(""),
                model_dir: PathBuf::from(""),
                run_mode: RunMode::Cpu,
            },
            status: EngineStatus::Stopped,
            process_handle: None,
        }
    }

    // 实际的启动、停止、自检逻辑将在后续步骤中实现
    // 现在只需实现基础的状态和配置读写

    pub fn config(&self) -> EngineConfig {
        self.config.clone()
    }

    pub fn status(&self) -> EngineStatus {
        self.status.clone()
    }

    pub fn update_config(&mut self, config: EngineConfig) {
        self.config = config;
    }

    pub fn set_status(&mut self, status: EngineStatus) {
        self.status = status;
    }
}

impl Default for EngineManager {
    fn default() -> Self {
        Self::new()
    }
}
