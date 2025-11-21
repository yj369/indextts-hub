// src-tauri/src/commands/system_info.rs

use serde::{Deserialize, Serialize};
use sysinfo::{Disks, System};
use tokio::process::Command;

// Re-using GpuInfo from index_tts.rs to avoid duplication
#[derive(Debug, Serialize, Deserialize)]
pub struct GpuInfo {
    pub has_cuda: bool,
    pub name: Option<String>,
    pub vram_gb: Option<f64>,
    pub recommended_fp16: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub cpu_brand: String,
    pub cpu_cores: Option<usize>,
    pub total_memory_gb: f64,
    pub available_memory_gb: f64,
    pub total_disk_gb: f64,
    pub available_disk_gb: f64,
    pub gpu_info: Option<GpuInfo>, // Add GPU info here
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, String> {
    let mut sys = System::new_all();
    sys.refresh_all();

    // OS information
    let os = System::name().unwrap_or_else(|| "Unknown OS".to_string());

    // CPU information
    let cpu_brand = sys
        .cpus()
        .first()
        .map_or("Unknown CPU".to_string(), |cpu| cpu.brand().to_string());
    let cpu_cores = sys.cpus().len();

    // Memory information (convert to GB)
    let total_memory_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let available_memory_gb = sys.available_memory() as f64 / 1024.0 / 1024.0 / 1024.0;

    // Disk information (sum up all disks, convert to GB)
    let disks = Disks::new_with_refreshed_list();
    let mut total_disk_bytes: u64 = 0;
    let mut available_disk_bytes: u64 = 0;
    for disk in disks.list() {
        total_disk_bytes += disk.total_space();
        available_disk_bytes += disk.available_space();
    }
    let total_disk_gb = total_disk_bytes as f64 / 1024.0 / 1024.0 / 1024.0;
    let available_disk_gb = available_disk_bytes as f64 / 1024.0 / 1024.0 / 1024.0;

    // GPU information (attempt to get using a dummy script or NVRM/DXGI directly)
    // For simplicity, we'll try to detect NVIDIA cards and assume CUDA availability
    let mut gpu_info: Option<GpuInfo> = None;

    // Attempt to detect NVIDIA GPU using nvidia-smi
    let nvidia_smi_output = Command::new("nvidia-smi")
        .arg("--query-gpu=name,memory.total,driver_version")
        .arg("--format=csv,noheader")
        .output()
        .await;

    if let Ok(output) = nvidia_smi_output {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let line = stdout.lines().next();
            if let Some(l) = line {
                let parts: Vec<&str> = l.split(',').map(|s| s.trim()).collect();
                if parts.len() >= 2 {
                    let name = Some(parts[0].to_string());
                    // Extract VRAM in MiB, convert to GB
                    let vram_mib_str = parts[1].replace(" MiB", "");
                    let vram_gb = vram_mib_str.parse::<f64>().ok().map(|mib| mib / 1024.0);

                    let has_cuda = true; // If nvidia-smi works, assume CUDA is available
                    let recommended_fp16 = vram_gb.map_or(false, |vram| vram > 8.0);

                    gpu_info = Some(GpuInfo {
                        has_cuda,
                        name,
                        vram_gb,
                        recommended_fp16,
                    });
                }
            }
        }
    }

    Ok(SystemInfo {
        os,
        cpu_brand,
        cpu_cores: Some(cpu_cores),
        total_memory_gb,
        available_memory_gb,
        total_disk_gb,
        available_disk_gb,
        gpu_info,
    })
}
