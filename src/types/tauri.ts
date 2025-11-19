export interface SystemInfo {
  os: string;
  cpu_brand: string;
  cpu_cores?: number | null;
  total_memory_gb: number;
  available_memory_gb: number;
  total_disk_gb: number;
  available_disk_gb: number;
}

export interface ToolStatus {
  git_installed: boolean;
  git_lfs_installed: boolean;
  uv_installed: boolean;
}

export enum ModelSource {
  HuggingFace = "HuggingFace",
  ModelScope = "ModelScope",
}

export interface GpuInfo {
  has_cuda: boolean;
  name?: string | null;
  vram_gb?: number | null;
  recommended_fp16: boolean;
}

export enum ServerStatus {
  Running = "Running",
  Stopped = "Stopped",
  Error = "Error",
}
