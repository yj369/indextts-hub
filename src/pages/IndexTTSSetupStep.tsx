import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useWizard } from '../context/WizardContext';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import MagicCard from '../components/MagicCard';
import { Loader2, Play, FolderOpen, HardDrive, GitBranch, Layers } from 'lucide-react';
import {cn} from "@/lib/utils.ts";

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
            // This invoke might fail if not implemented in backend yet, wrapping in try/catch
            const defaultPath = await invoke<string>('get_default_repo_path').catch(() => '');
            return defaultPath;
        } catch (err) {
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
        setSetupLogs(prev => [...prev, ">>> Starting IndexTTS Initialization Sequence"]);

        if (!repoDir) {
            setError("Target directory path is undefined.");
            setSettingUp(false);
            return;
        }

        // 1. Clone repository
        if (!repoCloned) {
            addLog(`> Cloning repository to: ${repoDir}`);
            try {
                const cloneResult: string = await invoke('clone_index_tts_repo', { targetDir: repoDir });
                addLog(cloneResult);
                setRepoCloned(true);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                addLog(`[FATAL] Clone failed: ${errMsg}`);
                setError(errMsg);
                setSettingUp(false);
                return;
            }
        } else {
            addLog("> Repository check: OK");
        }

        // 2. Setup environment
        if (repoCloned && !envSetup) {
            addLog("> Initializing Python virtual environment (uv)...");
            let pypiMirror: string | null = null;
            if (networkEnvironment === 'mainland_china') {
                pypiMirror = "https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple";
                addLog(`> Applied Mirror: ${pypiMirror}`);
            }

            try {
                const setupResult: string = await invoke('setup_index_tts_env', { repoDir: repoDir, pypiMirror: pypiMirror });
                addLog(setupResult);
                setEnvSetup(true);
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                addLog(`[FATAL] Env setup failed: ${errMsg}`);
                setError(errMsg);
                setSettingUp(false);
                return;
            }
        } else if (envSetup) {
            addLog("> Environment check: OK");
        }

        if (repoCloned && envSetup) {
            addLog(">>> Initialization Complete.");
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
            console.error(err);
        }
    };

    const handleNext = () => {
        onNext({ repoCloned, envSetup, setupLogs, repoDir });
    };

    const isNextDisabled = settingUp || !repoCloned || !envSetup;

    return (
        <div className="space-y-6">
            {/* Path Configuration */}
            <MagicCard className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
                        <HardDrive className="w-4 h-4" /> Installation Path
                    </h3>
                    <span className="text-[10px] font-mono text-gray-500">LOCAL FILESYSTEM</span>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            className="w-full h-10 rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            value={repoDir}
                            onChange={(e) => {
                                setRepoDir(e.target.value);
                                setIndexTtsRepoDir(e.target.value);
                            }}
                            disabled={settingUp}
                            placeholder="/path/to/install/indextts"
                        />
                    </div>
                    <Button variant="outline" onClick={handleBrowseRepoDir} disabled={settingUp}>
                        <FolderOpen className="w-4 h-4" />
                    </Button>
                </div>
            </MagicCard>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Actions */}
                <div className="md:col-span-1 space-y-3">
                    <Button
                        onClick={handleSetupIndexTTS}
                        disabled={settingUp}
                        className="w-full h-auto py-4 flex flex-col gap-2 items-center justify-center"
                        variant="default"
                    >
                        {settingUp ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
                        <span className="text-xs uppercase font-bold">{settingUp ? 'EXECUTING...' : 'START SETUP'}</span>
                    </Button>

                    <div className="space-y-2">
                        <div className={cn("p-3 rounded-lg border flex items-center justify-between", repoCloned ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/5 text-gray-500")}>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase"><GitBranch className="w-4 h-4" /> Clone Repo</div>
                            <div className={cn("w-2 h-2 rounded-full", repoCloned ? "bg-green-500" : "bg-gray-700")} />
                        </div>
                        <div className={cn("p-3 rounded-lg border flex items-center justify-between", envSetup ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-white/5 border-white/5 text-gray-500")}>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase"><Layers className="w-4 h-4" /> Python Env</div>
                            <div className={cn("w-2 h-2 rounded-full", envSetup ? "bg-green-500" : "bg-gray-700")} />
                        </div>
                    </div>
                </div>

                {/* Logs */}
                <div className="md:col-span-2 h-full">
                    <LogViewer logs={setupLogs} className="h-full min-h-[200px]" title="SETUP LOG" />
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono">
                    [ERROR] {error}
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

export default IndexTTSSetupStep;
