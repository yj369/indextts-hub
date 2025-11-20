import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemInfo, ToolStatus } from '../types/tauri';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { CheckCircle, XCircle, AlertCircle, Loader2, HardDrive, Cpu, MemoryStick, Activity, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

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
    const { indexTtsRepoDir } = useWizard();
    const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(initialData?.systemInfo || null);
    const [toolStatus, setToolStatus] = useState<ToolStatus | null>(initialData?.toolStatus || null);
    const [indexTtsRepoExists, setIndexTtsRepoExists] = useState<boolean>(initialData?.indexTtsRepoExists || false);
    const [canRunGpuCheck, setCanRunGpuCheck] = useState<boolean>(initialData?.canRunGpuCheck || false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const checkInProgressRef = useRef(false);

    const performChecks = useCallback(async () => {
        if (checkInProgressRef.current) return;
        checkInProgressRef.current = true;
        setChecking(true);
        setError(null);
        try {
            const currentSystemInfo: SystemInfo = await invoke('get_system_info');
            setSystemInfo(currentSystemInfo);

            const currentToolStatus: ToolStatus = await invoke('check_tools');
            setToolStatus(currentToolStatus);

            const repoExists = await invoke<boolean>('check_index_tts_repo', {
                repoDir: indexTtsRepoDir ?? null,
            });
            setIndexTtsRepoExists(repoExists);

            const gpuReady = Boolean(currentToolStatus.git_installed && currentToolStatus.uv_installed && repoExists);
            setCanRunGpuCheck(gpuReady);

        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setChecking(false);
            checkInProgressRef.current = false;
        }
    }, [indexTtsRepoDir]);

    const handleNext = () => {
        onNext({ systemInfo, toolStatus, indexTtsRepoExists, canRunGpuCheck });
    };

    useEffect(() => {
        performChecks();
    }, [performChecks]);

    const StatusItem = ({ label, status, waitingText = "Pending" }: { label: string, status: boolean | null, waitingText?: string }) => (
        <div className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
            <span className="text-sm font-medium text-gray-300">{label}</span>
            {status === null ? (
                <span className="flex items-center text-gray-500 text-xs uppercase tracking-wider">
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" /> {waitingText}
                </span>
            ) : status ? (
                <span className="flex items-center text-green-400 text-xs uppercase tracking-wider bg-green-400/10 px-2 py-1 rounded border border-green-400/20">
                    <CheckCircle className="w-3 h-3 mr-1.5" /> Ready
                </span>
            ) : (
                <span className="flex items-center text-red-400 text-xs uppercase tracking-wider bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                    <XCircle className="w-3 h-3 mr-1.5" /> Missing
                </span>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <CipherRevealText text="ENVIRONMENT SCAN" className="text-xl font-bold tracking-tight text-white" />
                    <p className="text-xs text-gray-500 font-mono mt-1">Analysis of local runtime & dependencies</p>
                </div>
                <Button onClick={performChecks} disabled={checking} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className={cn("w-3 h-3", checking && "animate-spin")} />
                    {checking ? 'SCANNING...' : 'RESCAN'}
                </Button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg flex items-center gap-3 text-sm">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                {/* System Stats */}
                <MagicCard className="p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 text-secondary">
                        <Activity className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-widest">System Resources</h3>
                    </div>

                    {systemInfo ? (
                        <div className="grid gap-4 flex-1">
                            <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase">Operating System</div>
                                <div className="font-mono text-sm text-white truncate">{systemInfo.os}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-xs text-gray-500 uppercase flex items-center gap-1"><Cpu className="w-3 h-3"/> Processor</div>
                                <div className="font-mono text-sm text-white truncate">{systemInfo.cpu_brand}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 rounded bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-1"><MemoryStick className="w-3 h-3"/> Memory</div>
                                    <div className="text-lg font-bold text-white">{systemInfo.total_memory_gb.toFixed(1)} <span className="text-xs font-normal text-gray-500">GB</span></div>
                                    <div className="w-full bg-gray-700 h-1 mt-2 rounded-full overflow-hidden">
                                        <div className="bg-secondary h-full" style={{ width: `${(1 - systemInfo.available_memory_gb / systemInfo.total_memory_gb) * 100}%` }}></div>
                                    </div>
                                </div>
                                <div className="p-3 rounded bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-1"><HardDrive className="w-3 h-3"/> Storage</div>
                                    <div className="text-lg font-bold text-white">{systemInfo.total_disk_gb.toFixed(0)} <span className="text-xs font-normal text-gray-500">GB</span></div>
                                    <div className="w-full bg-gray-700 h-1 mt-2 rounded-full overflow-hidden">
                                        <div className="bg-primary h-full" style={{ width: `${(1 - systemInfo.available_disk_gb / systemInfo.total_disk_gb) * 100}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Gathering system metrics...
                        </div>
                    )}
                </MagicCard>

                {/* Dependencies */}
                <MagicCard className="p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 text-primary">
                        <HardDrive className="w-5 h-5" />
                        <h3 className="font-bold text-sm uppercase tracking-widest">Dependencies</h3>
                    </div>
                    <div className="flex-1 space-y-2">
                        <StatusItem label="Git Version Control" status={toolStatus?.git_installed ?? null} />
                        <StatusItem label="Git Large File Storage" status={toolStatus?.git_lfs_installed ?? null} />
                        <StatusItem label="uv Package Manager" status={toolStatus?.uv_installed ?? null} />
                        <StatusItem label="Project Repository" status={indexTtsRepoExists} waitingText="Not Cloned" />
                        <StatusItem label="GPU Check Capability" status={canRunGpuCheck} waitingText="Requirements Pending" />
                    </div>
                </MagicCard>
            </div>

            <div className="flex justify-end pt-2">
                <Button onClick={handleNext} disabled={checking} className="min-w-[120px]">
                    下一步
                </Button>
            </div>
        </div>
    );
};

export default EnvCheckStep;