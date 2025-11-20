import React, { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SystemInfo, ToolStatus } from '../types/tauri';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';


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
        if (checkInProgressRef.current) {
            return;
        }
        checkInProgressRef.current = true;
        setChecking(true);
        setError(null);
        try {
            // Get System Info
            const currentSystemInfo: SystemInfo = await invoke('get_system_info');
            setSystemInfo(currentSystemInfo);

            // Check Tools
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
        // We specifically only want to re-run when repo dir changes or on mount,
        // so we rely on performChecks' memoized dependencies.
    }, [performChecks]);

    const getStatusIcon = (status: boolean | null, pendingMessage: string = '等待') => {
        if (status === null) {
            return (
                <span className="flex items-center text-gray-400">
                    <AlertCircle className="w-4 h-4 mr-2" /> {pendingMessage}
                </span>
            );
        }
        return status ? (
            <span className="flex items-center text-success">
                <CheckCircle className="w-4 h-4 mr-2" /> 已就绪
            </span>
        ) : (
            <span className="flex items-center text-destructive">
                <XCircle className="w-4 h-4 mr-2" /> 未安装
            </span>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col items-center gap-1.5 text-center">
                <CipherRevealText text="环境检查" className="text-2xl font-semibold" interval={80} />
                <p className="text-xs text-foreground/60">点击检测即可。</p>
                <Button onClick={performChecks} disabled={checking} size="sm" className="px-4">
                    {checking ? (
                        <span className="flex items-center">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 检查中
                        </span>
                    ) : (
                        '重新检测'
                    )}
                </Button>
            </div>

            {error && (
                <MagicCard className="p-4 bg-destructive/20 border-destructive text-destructive flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    <span>Error: {error}</span>
                </MagicCard>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
                {systemInfo && (
                    <MagicCard className="p-3">
                        <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em] mb-2">系统</h3>
                        <ul className="list-none space-y-1.5 text-xs text-foreground/70">
                            <li className="flex justify-between">
                                <span>操作系统</span>
                                <span className="font-medium">{systemInfo.os}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>CPU</span>
                                <span className="font-medium">{systemInfo.cpu_brand}</span>
                            </li>
                            <li className="flex justify-between">
                                <span>内存</span>
                                <span className="font-medium">{systemInfo.total_memory_gb.toFixed(1)} GB</span>
                            </li>
                            <li className="flex justify-between">
                                <span>可用内存</span>
                                <span className="font-medium">{systemInfo.available_memory_gb.toFixed(1)} GB</span>
                            </li>
                            <li className="flex justify-between">
                                <span>磁盘</span>
                                <span className="font-medium">{systemInfo.total_disk_gb.toFixed(1)} GB</span>
                            </li>
                            <li className="flex justify-between">
                                <span>可用磁盘</span>
                                <span className="font-medium">{systemInfo.available_disk_gb.toFixed(1)} GB</span>
                            </li>
                        </ul>
                    </MagicCard>
                )}

                {toolStatus && (
                    <MagicCard className="p-3">
                        <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em] mb-2">依赖</h3>
                        <ul className="list-none space-y-1.5 text-xs text-foreground/70">
                            <li className="flex justify-between items-center">
                                <span>Git</span> {getStatusIcon(toolStatus.git_installed)}
                            </li>
                            <li className="flex justify-between items-center">
                                <span>Git LFS</span> {getStatusIcon(toolStatus.git_lfs_installed)}
                            </li>
                            <li className="flex justify-between items-center">
                                <span>uv</span> {getStatusIcon(toolStatus.uv_installed)}
                            </li>
                            <li className="flex justify-between items-center">
                                <span>仓库</span> {getStatusIcon(indexTtsRepoExists, '未克隆')}
                            </li>
                            <li className="flex justify-between items-center">
                                <span>GPU 检测</span> {getStatusIcon(canRunGpuCheck, '等待依赖')}
                            </li>
                        </ul>
                    </MagicCard>
                )}
            </div>
            <div className="flex justify-end pt-2">
                <Button onClick={handleNext} disabled={checking} size="sm">
                    继续
                </Button>
            </div>
        </div>
    );
};

export default EnvCheckStep;
