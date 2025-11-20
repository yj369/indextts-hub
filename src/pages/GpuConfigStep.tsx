import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import LogViewer from '../components/LogViewer';
import { GpuInfo } from '../types/tauri';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { Loader2, Play, CheckCircle, XCircle, MemoryStick, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../lib/utils'; // Assuming cn is available

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
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <CipherRevealText text="GPU 设置" className="text-2xl font-semibold" interval={80} />
                <p className="text-sm text-foreground/60">检测 GPU 并选择加速方式。</p>
            </div>

            <div className="flex justify-center">
                <Button onClick={handleRunGpuCheck} disabled={checkingGpu} className="px-6">
                    {checkingGpu ? (
                        <span className="flex items-center">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 检测中
                        </span>
                    ) : (
                        <span className="flex items-center">
                            <Play className="w-4 h-4 mr-2" /> 检测 GPU
                        </span>
                    )}
                </Button>
            </div>

            {error && (
                <MagicCard className="p-4 bg-destructive/10 border-destructive/40 text-destructive flex items-center gap-2 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>{error}</span>
                </MagicCard>
            )}

            {gpuInfo && (
                <>
                    <MagicCard className="p-4">
                        <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MemoryStick className="w-4 h-4 text-secondary" /> 硬件
                        </h3>
                        <ul className="list-none space-y-2 text-sm text-foreground/70">
                            <li className="flex justify-between items-center">
                                <span>名称</span>
                                <span className="font-medium">{gpuInfo.name || 'N/A'}</span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span>CUDA Available:</span>
                                <span className="font-medium flex items-center">
                                    {gpuInfo.has_cuda ? (
                                        <CheckCircle className="w-4 h-4 mr-2 text-success" />
                                    ) : (
                                        <XCircle className="w-4 h-4 mr-2 text-destructive" />
                                    )}
                                    {gpuInfo.has_cuda ? 'Yes' : 'No'}
                                </span>
                            </li>
                            <li className="flex justify-between items-center">
                                <span>VRAM:</span>
                                <span className="font-medium">{gpuInfo.vram_gb ? `${gpuInfo.vram_gb.toFixed(2)} GB` : 'N/A'}</span>
                            </li>
                        </ul>
                    </MagicCard>

                    <MagicCard className="p-4">
                        <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide mb-3">加速</h3>
                        <div className="space-y-4">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-sm text-foreground/80 flex items-center">
                                    {useFp16Local ? <ToggleRight className="w-5 h-5 mr-3 text-primary" /> : <ToggleLeft className="w-5 h-5 mr-3 text-gray-500" />}
                                    启用 FP16
                                </span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={useFp16Local}
                                    onChange={(e) => setUseFp16Local(e.target.checked)}
                                    disabled={!gpuInfo.has_cuda}
                                />
                                <div className={cn(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                    !gpuInfo.has_cuda && "opacity-50 cursor-not-allowed",
                                    useFp16Local ? "bg-primary" : "bg-gray-700"
                                )}>
                                    <span className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        useFp16Local ? "translate-x-6" : "translate-x-1"
                                    )} />
                                </div>
                            </label>
                            {(gpuInfo.recommended_fp16 && gpuInfo.has_cuda) && (
                                <p className="ml-8 text-success text-xs -mt-3">推荐，节省显存。</p>
                            )}
                            {!gpuInfo.has_cuda && (
                                <p className="ml-8 text-warning text-xs -mt-3">仅 CUDA GPU 可用。</p>
                            )}

                            <label className="flex items-center justify-between cursor-pointer group">
                                <span className="text-sm text-foreground/80 flex items-center">
                                    {useDeepspeedLocal ? <ToggleRight className="w-5 h-5 mr-3 text-primary" /> : <ToggleLeft className="w-5 h-5 mr-3 text-gray-500" />}
                                    启用 Deepspeed
                                </span>
                                <input
                                    type="checkbox"
                                    className="sr-only"
                                    checked={useDeepspeedLocal}
                                    onChange={(e) => setUseDeepspeedLocal(e.target.checked)}
                                    disabled={!gpuInfo.has_cuda}
                                />
                                <div className={cn(
                                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                                    !gpuInfo.has_cuda && "opacity-50 cursor-not-allowed",
                                    useDeepspeedLocal ? "bg-primary" : "bg-gray-700"
                                )}>
                                    <span className={cn(
                                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                        useDeepspeedLocal ? "translate-x-6" : "translate-x-1"
                                    )} />
                                </div>
                            </label>
                            {!gpuInfo.has_cuda && (
                                <p className="ml-8 text-warning text-xs -mt-3">需 CUDA GPU。</p>
                            )}
                        </div>
                    </MagicCard>
                </>
            )}

            {gpuCheckLogs.length > 0 && (
                <LogViewer logs={gpuCheckLogs} />
            )}

            <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={isNextDisabled}>
                    继续
                </Button>
            </div>
        </div>
    );
};

export default GpuConfigStep;
