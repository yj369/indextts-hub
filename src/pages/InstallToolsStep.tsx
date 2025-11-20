import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { CheckCircle, XCircle, AlertCircle, Loader2, Download, BookOpen } from 'lucide-react';

interface InstallToolsStepProps {
    onNext: (data: InstallToolsStepData) => void;
    initialData?: InstallToolsStepData;
}

export interface InstallToolsStepData {
    gitInstalled: boolean;
    uvInstalled: boolean;
    installationLogs: string[];
}

const InstallToolsStep: React.FC<InstallToolsStepProps> = ({ onNext, initialData }) => {
    const { envCheckData } = useWizard();
    const [gitInstalled, setGitInstalled] = useState(initialData?.gitInstalled || false);
    const [uvInstalled, setUvInstalled] = useState(initialData?.uvInstalled || false);
    const [installationLogs, setInstallationLogs] = useState<string[]>(initialData?.installationLogs || []);
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isMounted = useRef(true); // To prevent state updates on unmounted component

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    const addLog = (message: string) => {
        if (isMounted.current) {
            setInstallationLogs((prev) => [...prev, message]);
        }
    };

    const handleInstallGit = async () => {
        addLog("Attempting to install Git and Git LFS...");
        try {
            const result: string = await invoke('install_git_and_lfs');
            addLog(result);
            if (isMounted.current) {
                setGitInstalled(true);
            }
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error installing Git: ${errMsg}`);
            if (isMounted.current) {
                setError(errMsg);
            }
            return false;
        }
    };

    const handleInstallUv = async () => {
        addLog("Attempting to install uv...");
        try {
            const result: string = await invoke('install_uv');
            addLog(result);
            if (isMounted.current) {
                setUvInstalled(true);
            }
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error installing uv: ${errMsg}`);
            if (isMounted.current) {
                setError(errMsg);
            }
            return false;
        }
    };

    const handleInstallAllMissing = async () => {
        if (isMounted.current) {
            setInstalling(true);
            setError(null);
            setInstallationLogs([]);
        }

        let success = true;

        if (!envCheckData?.toolStatus?.git_installed && !gitInstalled) {
            success = await handleInstallGit() && success;
        } else {
            addLog("Git is already installed.");
            if (isMounted.current) {
                setGitInstalled(true);
            }
        }

        if (!envCheckData?.toolStatus?.uv_installed && !uvInstalled) {
            success = await handleInstallUv() && success;
        } else {
            addLog("uv is already installed.");
            if (isMounted.current) {
                setUvInstalled(true);
            }
        }

        if (success) {
            addLog("All missing tools installed successfully!");
        } else {
            addLog("Some tools failed to install. Please check logs for details.");
        }
        if (isMounted.current) {
            setInstalling(false);
        }
    };

    const handleOpenGitDownload = async () => {
        await openUrl('https://git-scm.com/download/win');
    };

    const handleOpenUvDocs = async () => {
        await openUrl('https://docs.astral.sh/uv/install');
    };

    const handleNext = () => {
        onNext({ gitInstalled, uvInstalled, installationLogs });
    };

    const getToolStatusDisplay = (toolName: string, isInstalled: boolean, isInitiallyInstalled: boolean) => {
        if (isInstalled) {
            return (
                <span className="flex items-center text-success">
                    <CheckCircle className="w-4 h-4 mr-2" /> 已安装
                </span>
            );
        } else if (installing && !isInitiallyInstalled) {
            return (
                <span className="flex items-center text-primary animate-pulse">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 安装中
                </span>
            );
        } else {
            return (
                <span className="flex items-center text-destructive">
                    <XCircle className="w-4 h-4 mr-2" /> 未安装
                </span>
            );
        }
    };

    const isNextDisabled = installing || !gitInstalled || !uvInstalled;

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1.5">
                <CipherRevealText text="安装依赖" className="text-2xl font-semibold" interval={80} />
                <p className="text-xs text-foreground/60">Git / LFS 与 uv 必须就绪。</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <MagicCard className="p-3">
                    <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em] mb-2">状态</h3>
                    <ul className="list-none space-y-1.5 text-xs">
                        <li className="flex justify-between items-center">
                            <span>Git & LFS</span>
                            {getToolStatusDisplay('Git & Git LFS', gitInstalled, !!envCheckData?.toolStatus?.git_installed)}
                        </li>
                        <li className="flex justify-between items-center">
                            <span>uv</span>
                            {getToolStatusDisplay('uv', uvInstalled, !!envCheckData?.toolStatus?.uv_installed)}
                        </li>
                    </ul>
                    <div className="pt-3 text-right">
                        <Button onClick={handleInstallAllMissing} disabled={installing} size="sm">
                            {installing ? (
                                <span className="flex items-center">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 安装中
                                </span>
                            ) : (
                                '自动安装'
                            )}
                        </Button>
                    </div>
                </MagicCard>

                <MagicCard className="p-3 space-y-2">
                    <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em]">日志</h3>
                    <LogViewer logs={installationLogs} className="h-28" />
                </MagicCard>
            </div>

            {error && (
                <MagicCard className="p-4 border-warning/60 bg-warning/10 text-warning space-y-3">
                    <div className="flex items-center gap-2 text-xs">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 text-xs">
                        <Button variant="outline" size="sm" onClick={handleOpenGitDownload} className="gap-2">
                            <Download className="w-4 h-4" /> Git 链接
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleOpenUvDocs} className="gap-2">
                            <BookOpen className="w-4 h-4" /> uv 指南
                        </Button>
                    </div>
                </MagicCard>
            )}

            <div className="flex justify-end pt-2">
                <Button onClick={handleNext} disabled={isNextDisabled} size="sm">
                    继续
                </Button>
            </div>
        </div>
    );
};

export default InstallToolsStep;
