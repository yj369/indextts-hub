// src-tauri/src/commands/system_info.rs

use sysinfo::{Disks, System};
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub cpu_brand: String,
    pub cpu_cores: Option<usize>,
    pub total_memory_gb: f64,
    pub available_memory_gb: f64,
    pub total_disk_gb: f64,
    pub available_disk_gb: f64,
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
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

    Ok(SystemInfo {
        os,
        cpu_brand,
        cpu_cores: Some(cpu_cores),
        total_memory_gb,
        available_memory_gb,
        total_disk_gb,
        available_disk_gb,
    })
}
