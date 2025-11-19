import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import LogViewer from '../components/LogViewer'; // Import LogViewer

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
    const [repoDir, setRepoDir] = useState(initialData?.repoDir || ''); // Default or user-selected path
    const [settingUp, setSettingUp] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLog = (message: string) => {
        setSetupLogs((prev) => [...prev, message]);
    };

    const defaultRepoPath = async () => {
        // This should eventually come from a Tauri command that returns
        // a user-friendly default path (e.g., ~/.indextts2/index-tts)
        // For now, a placeholder
        // TODO: Replace with actual path resolution from backend
        return '/Users/yuxuan/Desktop/indextts-hub/indextts-repo'; // Placeholder, adjust as needed
    };

    useEffect(() => {
        async function setDefaultPath() {
            const path = await defaultRepoPath();
            setRepoDir(path);
            setIndexTtsRepoDir(path); // Update global context
        }
        if (!initialData?.repoDir) {
            setDefaultPath();
        }
    }, [initialData?.repoDir, setIndexTtsRepoDir]);


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
        if (!envSetup) {
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
        } else {
            addLog("IndexTTS2 environment already set up.");
        }


        addLog("IndexTTS2 setup completed successfully!");
        setSettingUp(false);
    };

    const handleCopyLogs = async () => {
        if (setupLogs.length > 0) {
            const logsContent = setupLogs.join('\n');
            try {
                await navigator.clipboard.writeText(logsContent);
                alert("Logs copied to clipboard!");
            } catch (err) {
                console.error("Failed to copy logs:", err);
                alert("Failed to copy logs to clipboard. Check console for details.");
            }
        }
    };


    const handleNext = () => {
        onNext({ repoCloned, envSetup, setupLogs, repoDir });
    };

    const isNextDisabled = settingUp || !repoCloned || !envSetup;


    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Install IndexTTS2 & Dependencies</h2>
            <p>This step will clone the IndexTTS2 repository and set up its Python environment.</p>

            <div className="form-control">
                <label className="label">
                    <span className="label-text">IndexTTS2 Repository Path:</span>
                </label>
                <input
                    type="text"
                    placeholder="e.g., C:\Users\YourUser\.indextts2\index-tts"
                    className="input input-bordered w-full"
                    value={repoDir}
                    onChange={(e) => {
                        setRepoDir(e.target.value);
                        setIndexTtsRepoDir(e.target.value); // Update global context
                    }}
                    disabled={settingUp}
                />
                 <span className="label-text-alt mt-1">
                    Default: {repoDir || 'Resolving default path...'}
                </span>
            </div>

            <button className="btn btn-primary" onClick={handleSetupIndexTTS} disabled={settingUp}>
                {settingUp ? 'Setting up...' : 'Start IndexTTS2 Setup'}
            </button>

            {error && (
                <div className="text-error-content bg-error p-2 rounded flex justify-between items-center">
                    <span>{error}</span>
                    <button className="btn btn-sm btn-error" onClick={handleCopyLogs}>Copy Logs</button>
                </div>
            )}

            {setupLogs.length > 0 && (
                <LogViewer logs={setupLogs} />
            )}

            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={isNextDisabled}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default IndexTTSSetupStep;
