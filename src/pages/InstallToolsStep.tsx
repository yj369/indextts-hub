import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import { CheckCircle, AlertCircle, Loader2, Download, ExternalLink, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';

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

    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const addLog = (message: string) => {
        if (isMounted.current) {
            setInstallationLogs((prev) => [...prev, message]);
        }
    };

    const handleInstallGit = async () => {
        addLog("> Initializing Git installer...");
        try {
            const result: string = await invoke('install_git_and_lfs');
            addLog(result);
            if (isMounted.current) setGitInstalled(true);
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`[ERROR] Git installation failed: ${errMsg}`);
            if (isMounted.current) setError(errMsg);
            return false;
        }
    };

    const handleInstallUv = async () => {
        addLog("> Initializing uv installer...");
        try {
            const result: string = await invoke('install_uv');
            addLog(result);
            if (isMounted.current) setUvInstalled(true);
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`[ERROR] uv installation failed: ${errMsg}`);
            if (isMounted.current) setError(errMsg);
            return false;
        }
    };

    const handleInstallAllMissing = async () => {
        if (isMounted.current) {
            setInstalling(true);
            setError(null);
            setInstallationLogs(prev => [...prev, "--- Starting Automated Installation Sequence ---"]);
        }

        let success = true;

        if (!envCheckData?.toolStatus?.git_installed && !gitInstalled) {
            success = await handleInstallGit() && success;
        } else {
            addLog("> Git is already present.");
            if (isMounted.current) setGitInstalled(true);
        }

        if (!envCheckData?.toolStatus?.uv_installed && !uvInstalled) {
            success = await handleInstallUv() && success;
        } else {
            addLog("> uv is already present.");
            if (isMounted.current) setUvInstalled(true);
        }

        if (success) {
            addLog("--- Installation Sequence Completed Successfully ---");
        } else {
            addLog("[WARNING] Sequence completed with errors.");
        }
        if (isMounted.current) {
            setInstalling(false);
        }
    };

    const handleNext = () => {
        onNext({ gitInstalled, uvInstalled, installationLogs });
    };

    const ToolStatusRow = ({ name, installed, link }: { name: string, installed: boolean, link: string }) => (
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group">
            <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", installed ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")} />
                <span className="font-medium text-sm">{name}</span>
            </div>
            <div className="flex items-center gap-3">
                {installed ? (
                    <span className="text-green-400 text-xs uppercase font-bold">Installed</span>
                ) : (
                    <button onClick={() => openUrl(link)} className="text-gray-500 hover:text-white transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );

    const isNextDisabled = installing || !gitInstalled || !uvInstalled;

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-5">
                {/* Left Column: Status */}
                <div className="md:col-span-2 space-y-4">
                    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
                        <div className="flex items-center gap-2 text-primary mb-2">
                            <Terminal className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Required Tools</h3>
                        </div>
                        <ToolStatusRow
                            name="Git & LFS"
                            installed={gitInstalled || !!envCheckData?.toolStatus?.git_installed}
                            link="https://git-scm.com/download/win"
                        />
                        <ToolStatusRow
                            name="uv Manager"
                            installed={uvInstalled || !!envCheckData?.toolStatus?.uv_installed}
                            link="https://docs.astral.sh/uv/install"
                        />
                    </div>

                    <Button
                        onClick={handleInstallAllMissing}
                        disabled={installing || (gitInstalled && uvInstalled)}
                        className="w-full"
                        variant={gitInstalled && uvInstalled ? "secondary" : "default"}
                    >
                        {installing ? (
                            <> <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 安装中... </>
                        ) : gitInstalled && uvInstalled ? (
                            <> <CheckCircle className="w-4 h-4 mr-2" /> 全部就绪 </>
                        ) : (
                            <> <Download className="w-4 h-4 mr-2" /> 一键安装缺失项 </>
                        )}
                    </Button>
                </div>

                {/* Right Column: Logs */}
                <div className="md:col-span-3">
                    <LogViewer logs={installationLogs} className="h-full min-h-[240px]" title="INSTALLATION LOG" />
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            <div className="flex justify-end pt-2">
                <Button onClick={handleNext} disabled={isNextDisabled} className="px-8">
                    继续
                </Button>
            </div>
        </div>
    );
};

export default InstallToolsStep;
