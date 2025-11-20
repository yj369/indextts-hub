import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import { GpuInfo } from '../types/tauri';
import MagicCard from '../components/MagicCard';
import { Loader2, Cpu, Zap, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';

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

    const handleRunGpuCheck = async () => {
        setCheckingGpu(true);
        setGpuCheckLogs([]);
        try {
            // Mock log for visual effect if repo not set, logic handles real error
            if (!indexTtsRepoDir) throw new Error("Repo dir missing");

            const result: GpuInfo = await invoke('run_gpu_check', { repoDir: indexTtsRepoDir });
            setGpuInfo(result);
            setUseFp16Local(result.recommended_fp16);
            setUseFp16(result.recommended_fp16);
        } catch (err) {
            console.error(err);
        } finally {
            setCheckingGpu(false);
        }
    };

    const handleNext = () => {
        setUseFp16(useFp16Local);
        setUseDeepspeed(useDeepspeedLocal);
        onNext({ gpuInfo, useFp16: useFp16Local, useDeepspeed: useDeepspeedLocal, gpuCheckLogs });
    };

    const Switch = ({ checked, onChange, disabled, label }: any) => (
        <div
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer",
                disabled ? "opacity-50 cursor-not-allowed border-white/5 bg-white/5" :
                    checked ? "border-primary/50 bg-primary/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]" : "border-white/10 bg-black/40 hover:border-white/30"
            )}
        >
            <span className="font-bold text-sm">{label}</span>
            <div className={cn("w-10 h-5 rounded-full relative transition-colors", checked ? "bg-primary" : "bg-gray-700")}>
                <div className={cn("absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {!gpuInfo ? (
                <div className="flex flex-col items-center justify-center h-[300px] border border-dashed border-white/20 rounded-2xl bg-black/20">
                    <div className="p-4 rounded-full bg-white/5 mb-4">
                        <Cpu className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 mb-6 text-sm">Hardware detection required</p>
                    <Button onClick={handleRunGpuCheck} disabled={checkingGpu}>
                        {checkingGpu ? <Loader2 className="animate-spin mr-2" /> : <Zap className="mr-2 w-4 h-4" />}
                        Run GPU Diagnostics
                    </Button>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    <MagicCard className="p-6 flex flex-col justify-center items-center text-center border-primary/30 bg-primary/5">
                        <div className="w-16 h-16 rounded-full bg-black border border-primary/50 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                            <Cpu className="w-8 h-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-black text-white mb-1">{gpuInfo.name || "Unknown GPU"}</h2>
                        <div className="flex gap-4 mt-4">
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">VRAM</div>
                                <div className="text-lg font-mono font-bold text-white">{gpuInfo.vram_gb?.toFixed(1)} GB</div>
                            </div>
                            <div className="w-px bg-white/10"></div>
                            <div className="text-center">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider">CUDA</div>
                                <div className="text-lg font-mono font-bold text-white flex justify-center items-center gap-1">
                                    {gpuInfo.has_cuda ? <Check className="text-green-500 w-4 h-4" /> : <X className="text-red-500 w-4 h-4" />}
                                </div>
                            </div>
                        </div>
                    </MagicCard>

                    <div className="space-y-3">
                        <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest mb-2">Optimization</h3>
                        <Switch
                            label="FP16 Precision"
                            checked={useFp16Local}
                            onChange={setUseFp16Local}
                            disabled={!gpuInfo.has_cuda}
                        />
                        <Switch
                            label="DeepSpeed Acceleration"
                            checked={useDeepspeedLocal}
                            onChange={setUseDeepspeedLocal}
                            disabled={!gpuInfo.has_cuda}
                        />
                        <div className="mt-4 p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 text-xs">
                            FP16 reduces memory usage significantly. DeepSpeed requires compatible CUDA environment.
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={!gpuInfo} className="px-8">
                    继续
                </Button>
            </div>
        </div>
    );
};

export default GpuConfigStep;
