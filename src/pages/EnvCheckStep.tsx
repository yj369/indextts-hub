import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemInfo, ToolStatus } from '../types/tauri';

interface EnvCheckStepProps {
    onNext: (data: EnvCheckStepData) => void;
    initialData?: EnvCheckStepData;
}

export interface EnvCheckStepData {
    systemInfo: SystemInfo | null;
    toolStatus: ToolStatus | null;
    indexTtsRepoExists: boolean;
    canRunGpuCheck: boolean;
}

const EnvCheckStep: React.FC<EnvCheckStepProps> = ({ onNext, initialData }) => {
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(initialData?.systemInfo || null);
    const [toolStatus, setToolStatus] = useState<ToolStatus | null>(initialData?.toolStatus || null);
    const [indexTtsRepoExists, setIndexTtsRepoExists] = useState<boolean>(initialData?.indexTtsRepoExists || false);
    const [canRunGpuCheck, setCanRunGpuCheck] = useState<boolean>(initialData?.canRunGpuCheck || false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const performChecks = async () => {
        setChecking(true);
        setError(null);
        try {
            // Get System Info
            const currentSystemInfo: SystemInfo = await invoke('get_system_info');
            setSystemInfo(currentSystemInfo);

            // Check Tools
            const currentToolStatus: ToolStatus = await invoke('check_tools');
            setToolStatus(currentToolStatus);

            // Check IndexTTS Repo existence (Placeholder for now)
            // This will need a new Tauri command or a more robust check.
            // For demonstration, let's assume it doesn't exist initially.
            setIndexTtsRepoExists(false); // TODO: Implement actual check

            // Determine if GPU check can run (requires git and uv for now)
            if (currentToolStatus.git_installed && currentToolStatus.uv_installed && indexTtsRepoExists) {
                setCanRunGpuCheck(true);
            } else {
                setCanRunGpuCheck(false);
            }

            // If the user said they have a GPU, we should try to run GPU check later if possible
            // The actual GPU check will run after repo clone and env setup.

        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setChecking(false);
        }
    };

    const handleNext = () => {
        onNext({ systemInfo, toolStatus, indexTtsRepoExists, canRunGpuCheck });
    };

    // Auto-run checks on component mount for initial display
    useEffect(() => {
        if (!initialData) { // Only run if no initial data provided, otherwise, assume data is loaded.
            performChecks();
        }
    }, []);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">System and Environment Check</h2>

            <button className="btn btn-primary" onClick={performChecks} disabled={checking}>
                {checking ? 'Checking...' : 'Start Check'}
            </button>

            {error && <div className="text-error-content bg-error p-2 rounded">{error}</div>}

            {systemInfo && (
                <div className="card bg-base-200 shadow-md p-4">
                    <h3 className="card-title">System Information</h3>
                    <ul className="list-disc list-inside">
                        <li>OS: {systemInfo.os}</li>
                        <li>CPU: {systemInfo.cpu_brand} ({systemInfo.cpu_cores || 'N/A'} cores)</li>
                        <li>Total RAM: {systemInfo.total_memory_gb.toFixed(2)} GB</li>
                        <li>Available RAM: {systemInfo.available_memory_gb.toFixed(2)} GB</li>
                        <li>Total Disk: {systemInfo.total_disk_gb.toFixed(2)} GB</li>
                        <li>Available Disk: {systemInfo.available_disk_gb.toFixed(2)} GB</li>
                    </ul>
                </div>
            )}

            {toolStatus && (
                <div className="card bg-base-200 shadow-md p-4">
                    <h3 className="card-title">Tool Status</h3>
                    <ul className="list-disc list-inside">
                        <li>Git: {toolStatus.git_installed ? '✅ Installed' : '🔴 Not Installed'}</li>
                        <li>Git LFS: {toolStatus.git_lfs_installed ? '✅ Installed' : '🔴 Not Installed'}</li>
                        <li>uv: {toolStatus.uv_installed ? '✅ Installed' : '🔴 Not Installed'}</li>
                        <li>IndexTTS2 Repository: {indexTtsRepoExists ? '✅ Cloned' : '⚪ Not Cloned'}</li>
                        <li>GPU Check Script Status: {canRunGpuCheck ? '✅ Ready' : '⚪ Pending (requires Git, uv, and repo)'}</li>
                    </ul>
                </div>
            )}
            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={checking}>
                    Continue to Install Missing Components
                </button>
            </div>
        </div>
    );
};

export default EnvCheckStep;
