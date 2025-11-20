import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useWizard } from '../context/WizardContext';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { Loader2, Play, FolderOpen, CheckCircle, XCircle, ClipboardCopy, HardDrive } from 'lucide-react';

interface IndexTTSSetupStepProps {
    onNext: (data: IndexTTSSetupStepData) => void;
    initialData?: IndexTTSSetupStepData;
}

export interface IndexTTSSetupStepData {
    repoCloned: boolean;
    envSetup: boolean;
    setupLogs: string[];
    repoDir: string;
}

const IndexTTSSetupStep: React.FC<IndexTTSSetupStepProps> = ({ onNext, initialData }) => {
    const { networkEnvironment, setIndexTtsRepoDir } = useWizard();
    const [repoCloned, setRepoCloned] = useState(initialData?.repoCloned || false);
    const [envSetup, setEnvSetup] = useState(initialData?.envSetup || false);
    const [setupLogs, setSetupLogs] = useState<string[]>(initialData?.setupLogs || []);
    const [repoDir, setRepoDir] = useState(initialData?.repoDir || '');
    const [settingUp, setSettingUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLog = (message: string) => {
        setSetupLogs((prev) => [...prev, message]);
    };

    const resolveDefaultRepoPath = useCallback(async () => {
        try {
            const defaultPath: string = await invoke('get_default_repo_path');
            return defaultPath;
        } catch (err) {
            console.error("Failed to get default repo path:", err);
            return '';
        }
    }, []);

    useEffect(() => {
        async function setDefaultPathIfNotSet() {
            if (!initialData?.repoDir) {
                const path = await resolveDefaultRepoPath();
                if (path) {
                    setRepoDir(path);
                    setIndexTtsRepoDir(path);
                }
            }
        }
        setDefaultPathIfNotSet();
    }, [initialData?.repoDir, setIndexTtsRepoDir, resolveDefaultRepoPath]);


    const handleSetupIndexTTS = async () => {
        setSettingUp(true);
        setError(null);
        setSetupLogs([]);

        if (!repoDir) {
            setError("IndexTTS repository path is not set.");
            setSettingUp(false);
            return;
        }

        // 1. Clone repository
        if (!repoCloned) {
            addLog(`Cloning IndexTTS2 repository to ${repoDir}...`);
            try {
                const cloneResult: string = await invoke('clone_index_tts_repo', { targetDir: repoDir });
                addLog(cloneResult);
                setRepoCloned(true);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                addLog(`Error cloning repository: ${errMsg}`);
                setError(errMsg);
                setSettingUp(false);
                return;
            }
        } else {
            addLog("IndexTTS2 repository already cloned.");
        }


        // 2. Setup environment with uv sync
        if (repoCloned && !envSetup) { // Only run if repo is cloned and env not yet setup
            addLog("Setting up IndexTTS2 environment with uv sync...");
            let pypiMirror: string | null = null;
            if (networkEnvironment === 'mainland_china') {
                pypiMirror = "https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple";
                addLog(`Using PyPI mirror: ${pypiMirror}`);
            }

            try {
                const setupResult: string = await invoke('setup_index_tts_env', { repoDir: repoDir, pypiMirror: pypiMirror });
                addLog(setupResult);
                setEnvSetup(true);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                addLog(`Error setting up environment: ${errMsg}`);
                setError(errMsg);
                setSettingUp(false);
                return;
            }
        } else if (envSetup) {
            addLog("IndexTTS2 environment already set up.");
        }


        if (repoCloned && envSetup) {
            addLog("IndexTTS2 setup completed successfully!");
        } else {
             addLog("IndexTTS2 setup encountered issues. Please check logs for details.");
        }
        setSettingUp(false);
    };

    const handleBrowseRepoDir = async () => {
        try {
            const selected = await open({
                multiple: false,
                directory: true,
                defaultPath: repoDir || undefined,
            });

            if (typeof selected === 'string') {
                setRepoDir(selected);
                setIndexTtsRepoDir(selected);
            }
        } catch (err) {
            console.error("Failed to open directory picker:", err);
        }
    };

    const handleCopyLogs = async () => {
        if (setupLogs.length > 0) {
            const logsContent = setupLogs.join('\n');
            try {
                await navigator.clipboard.writeText(logsContent);
                // alert("Logs copied to clipboard!"); // Use a toast notification instead of alert
            } catch (err) {
                console.error("Failed to copy logs:", err);
                // alert("Failed to copy logs to clipboard. Check console for details.");
            }
        }
    };


    const handleNext = () => {
        onNext({ repoCloned, envSetup, setupLogs, repoDir });
    };

    const isNextDisabled = settingUp || !repoCloned || !envSetup;


    return (
        <div className="space-y-4">
            <div className="text-center space-y-1.5">
                <CipherRevealText text="仓库配置" className="text-2xl font-semibold" interval={80} />
                <p className="text-xs text-foreground/60">确认路径并一键完成克隆与环境。</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <MagicCard className="p-3 space-y-2">
                    <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em] flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-secondary" /> 运行路径
                    </h3>
                    <input
                        type="text"
                        placeholder="如 /Users/me/.indextts2/index-tts"
                        className="w-full rounded-md border border-border bg-input px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        value={repoDir}
                        onChange={(e) => {
                            setRepoDir(e.target.value);
                            setIndexTtsRepoDir(e.target.value);
                        }}
                        disabled={settingUp}
                    />
                    <div className="flex items-center justify-between text-xs text-foreground/60">
                        <span>默认：{repoDir || '检测中'}</span>
                        <Button variant="outline" size="sm" onClick={handleBrowseRepoDir} disabled={settingUp}>
                            <FolderOpen className="w-4 h-4 mr-1" /> 浏览
                        </Button>
                    </div>
                </MagicCard>

                <MagicCard className="p-3">
                    <h3 className="text-xs font-semibold text-foreground/70 uppercase tracking-[0.25em] mb-2">进度</h3>
                    <ul className="list-none space-y-1.5 text-xs">
                        <li className="flex justify-between items-center">
                            <span>仓库</span>
                            {settingUp && !repoCloned ? (
                                <span className="flex items-center text-primary">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 克隆中
                                </span>
                            ) : repoCloned ? (
                                <span className="flex items-center text-success">
                                    <CheckCircle className="w-4 h-4 mr-2" /> 已克隆
                                </span>
                            ) : (
                                <span className="flex items-center text-destructive">
                                    <XCircle className="w-4 h-4 mr-2" /> 未完成
                                </span>
                            )}
                        </li>
                        <li className="flex justify-between items-center">
                            <span>环境</span>
                            {settingUp && repoCloned && !envSetup ? (
                                <span className="flex items-center text-primary">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 配置中
                                </span>
                            ) : envSetup ? (
                                <span className="flex items-center text-success">
                                    <CheckCircle className="w-4 h-4 mr-2" /> 已完成
                                </span>
                            ) : (
                                <span className="flex items-center text-destructive">
                                    <XCircle className="w-4 h-4 mr-2" /> 未完成
                                </span>
                            )}
                        </li>
                    </ul>
                    <div className="pt-3 text-right">
                        <Button onClick={handleSetupIndexTTS} disabled={settingUp} size="sm">
                            {settingUp ? (
                                <span className="flex items-center">
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 执行中
                                </span>
                            ) : (
                                <span className="flex items-center">
                                    <Play className="w-4 h-4 mr-2" /> 开始
                                </span>
                            )}
                        </Button>
                    </div>
                </MagicCard>
            </div>
            {error && (
                <MagicCard className="p-4 bg-destructive/10 border-destructive/40 text-destructive flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center">
                        <XCircle className="w-4 h-4 mr-2" /> {error}
                    </span>
                    <Button variant="destructive" size="sm" onClick={handleCopyLogs} className="flex items-center gap-2">
                        <ClipboardCopy className="w-4 h-4" /> 复制日志
                    </Button>
                </MagicCard>
            )}

            {setupLogs.length > 0 && (
                <LogViewer logs={setupLogs} />
            )}

            <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={isNextDisabled}>
                    继续
                </Button>
            </div>
        </div>
    );
};

export default IndexTTSSetupStep;
