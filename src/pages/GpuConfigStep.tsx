import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import LogViewer from '../components/LogViewer'; // Import LogViewer
import { GpuInfo } from '../types/tauri';

interface GpuConfigStepProps {
    onNext: (data: GpuConfigStepData) => void;
    initialData?: GpuConfigStepData;
}

export interface GpuConfigStepData {
    gpuInfo: GpuInfo | null;
    useFp16: boolean;
    useDeepspeed: boolean;
    gpuCheckLogs: string[];
}

const GpuConfigStep: React.FC<GpuConfigStepProps> = ({ onNext, initialData }) => {
    const { indexTtsRepoDir, setUseFp16, setUseDeepspeed } = useWizard();
    const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(initialData?.gpuInfo || null);
    const [useFp16Local, setUseFp16Local] = useState(initialData?.useFp16 || false);
    const [useDeepspeedLocal, setUseDeepspeedLocal] = useState(initialData?.useDeepspeed || false);
    const [checkingGpu, setCheckingGpu] = useState(false);
    const [gpuCheckLogs, setGpuCheckLogs] = useState<string[]>(initialData?.gpuCheckLogs || []);
    const [error, setError] = useState<string | null>(null);

    const addLog = (message: string) => {
        setGpuCheckLogs((prev) => [...prev, message]);
    };

    const handleRunGpuCheck = async () => {
        setCheckingGpu(true);
        setError(null);
        setGpuCheckLogs([]);

        if (!indexTtsRepoDir) {
            setError("IndexTTS repository directory is not set. Please complete previous steps.");
            setCheckingGpu(false);
            return;
        }

        addLog("Running GPU check script...");
        try {
            const result: GpuInfo = await invoke('run_gpu_check', { repoDir: indexTtsRepoDir });
            setGpuInfo(result);
            addLog(`GPU check completed. Detected GPU: ${result.name || 'N/A'}`);
            addLog(`CUDA available: ${result.has_cuda}`);
            addLog(`VRAM: ${result.vram_gb ? `${result.vram_gb.toFixed(2)} GB` : 'N/A'}`);
            addLog(`Recommended FP16: ${result.recommended_fp16}`);

            setUseFp16Local(result.recommended_fp16);
            setUseFp16(result.recommended_fp16);

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error running GPU check: ${errMsg}`);
            setError(errMsg);
        } finally {
            setCheckingGpu(false);
        }
    };

    const handleNext = () => {
        setUseFp16(useFp16Local);
        setUseDeepspeed(useDeepspeedLocal);
        onNext({ gpuInfo, useFp16: useFp16Local, useDeepspeed: useDeepspeedLocal, gpuCheckLogs });
    };

    const isNextDisabled = checkingGpu || !gpuInfo;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">GPU Detection & Acceleration Configuration</h2>
            <p>Run the GPU check to detect your hardware and configure acceleration settings.</p>

            <button className="btn btn-primary" onClick={handleRunGpuCheck} disabled={checkingGpu}>
                {checkingGpu ? 'Checking GPU...' : 'Run GPU Check'}
            </button>

            {error && <div className="text-error-content bg-error p-2 rounded">{error}</div>}

            {gpuInfo && (
                <div className="card bg-base-200 shadow-md p-4">
                    <h3 className="card-title">Detected GPU Information</h3>
                    <ul className="list-disc list-inside">
                        <li>GPU: {gpuInfo.name || 'N/A'}</li>
                        <li>CUDA Available: {gpuInfo.has_cuda ? 'Yes' : 'No'}</li>
                        <li>VRAM: {gpuInfo.vram_gb ? `${gpuInfo.vram_gb.toFixed(2)} GB` : 'N/A'}</li>
                    </ul>

                    <h3 className="card-title mt-4">Acceleration Settings</h3>
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={useFp16Local}
                                onChange={(e) => setUseFp16Local(e.target.checked)}
                                disabled={!gpuInfo.has_cuda}
                            />
                            <span className="label-text ml-3">Use FP16 (Half-precision, reduces VRAM usage)</span>
                        </label>
                        {gpuInfo.recommended_fp16 && gpuInfo.has_cuda && (
                             <span className="label-text-alt ml-7 text-success">Recommended for your GPU.</span>
                        )}
                        {!gpuInfo.has_cuda && (
                            <span className="label-text-alt ml-7 text-warning">Requires CUDA-enabled GPU.</span>
                        )}
                    </div>
                    <div className="form-control mt-2">
                        <label className="label cursor-pointer justify-start">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary"
                                checked={useDeepspeedLocal}
                                onChange={(e) => setUseDeepspeedLocal(e.target.checked)}
                                disabled={!gpuInfo.has_cuda}
                            />
                            <span className="label-text ml-3">Enable Deepspeed (May improve performance, or slow down)</span>
                        </label>
                         {!gpuInfo.has_cuda && (
                            <span className="label-text-alt ml-7 text-warning">Requires CUDA-enabled GPU.</span>
                        )}
                    </div>
                </div>
            )}

            {gpuCheckLogs.length > 0 && (
                <LogViewer logs={gpuCheckLogs} />
            )}

            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={isNextDisabled}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default GpuConfigStep;
