import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import LogViewer from '../components/LogViewer'; // Import LogViewer

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

    useEffect(() => {
        if (envCheckData?.toolStatus && !envCheckData.toolStatus.git_installed && !installing) {
            // handleInstallAllMissing(); // Disabled auto-install for now, user clicks button
        }
    }, [envCheckData, installing]);


    const addLog = (message: string) => {
        setInstallationLogs((prev) => [...prev, message]);
    };

    const handleInstallGit = async () => {
        addLog("Attempting to install Git and Git LFS...");
        try {
            const result: string = await invoke('install_git_and_lfs');
            addLog(result);
            setGitInstalled(true);
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error installing Git: ${errMsg}`);
            setError(errMsg);
            return false;
        }
    };

    const handleInstallUv = async () => {
        addLog("Attempting to install uv...");
        try {
            const result: string = await invoke('install_uv');
            addLog(result);
            setUvInstalled(true);
            return true;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error installing uv: ${errMsg}`);
            setError(errMsg);
            return false;
        }
    };

    const handleInstallAllMissing = async () => {
        setInstalling(true);
        setError(null);
        setInstallationLogs([]);

        let success = true;

        if (!envCheckData?.toolStatus?.git_installed) {
            success = await handleInstallGit() && success;
        } else {
            addLog("Git is already installed.");
            setGitInstalled(true);
        }

        if (!envCheckData?.toolStatus?.uv_installed) {
            success = await handleInstallUv() && success;
        } else {
            addLog("uv is already installed.");
            setUvInstalled(true);
        }

        if (success) {
            addLog("All missing tools installed successfully!");
        } else {
            addLog("Some tools failed to install. Please check logs for details.");
        }
        setInstalling(false);
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

    const isNextDisabled = installing || !gitInstalled || !uvInstalled;

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Install Basic Tools (Git, Git LFS, uv)</h2>
            <p>This step will attempt to install any missing core tools required for IndexTTS2.</p>

            {envCheckData && (
                <div className="card bg-base-200 shadow-md p-4">
                    <h3 className="card-title">Tools to install:</h3>
                    <ul className="list-disc list-inside">
                        {!envCheckData.toolStatus?.git_installed && <li>Git and Git LFS</li>}
                        {!envCheckData.toolStatus?.uv_installed && <li>uv</li>}
                        {envCheckData.toolStatus?.git_installed && envCheckData.toolStatus?.uv_installed && <li>All tools are already installed.</li>}
                    </ul>
                </div>
            )}

            <button className="btn btn-primary" onClick={handleInstallAllMissing} disabled={installing}>
                {installing ? 'Installing...' : 'Install Missing Tools'}
            </button>

            {error && <div className="text-error-content bg-error p-2 rounded">{error}</div>}

            {installationLogs.length > 0 && (
                <LogViewer logs={installationLogs} />
            )}

            {/* Manual installation prompts if automatic fails or not applicable */}
            {error && (
                <div className="mt-4 p-4 bg-warning-content text-warning rounded-md">
                    <p>Automatic installation failed or is not available for your system.</p>
                    <p>Please consider manual installation:</p>
                    <div className="flex gap-2 mt-2">
                        <button className="btn btn-sm btn-outline" onClick={handleOpenGitDownload}>Download Git</button>
                        <button className="btn btn-sm btn-outline" onClick={handleOpenUvDocs}>uv Installation Guide</button>
                    </div>
                </div>
            )}

            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={isNextDisabled}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default InstallToolsStep;
