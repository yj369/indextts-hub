import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import LogViewer from '../components/LogViewer'; // Import LogViewer
import { ModelSource } from '../types/tauri';

interface ModelDownloadStepProps {
    onNext: (data: ModelDownloadStepData) => void;
    initialData?: ModelDownloadStepData;
}

export interface ModelDownloadStepData {
    hfToolInstalled: boolean;
    msToolInstalled: boolean;
    modelDownloaded: boolean;
    downloadLogs: string[];
    selectedModelSource: ModelSource;
    modelSavePath: string;
}

const ModelDownloadStep: React.FC<ModelDownloadStepProps> = ({ onNext, initialData }) => {
    const { networkEnvironment, indexTtsRepoDir } = useWizard();
    const [hfToolInstalled, setHfToolInstalled] = useState(initialData?.hfToolInstalled || false);
    const [msToolInstalled, setMsToolInstalled] = useState(initialData?.msToolInstalled || false);
    const [modelDownloaded, setModelDownloaded] = useState(initialData?.modelDownloaded || false);
    const [downloadLogs, setDownloadLogs] = useState<string[]>(initialData?.downloadLogs || []);
    const [selectedModelSource, setSelectedModelSource] = useState<ModelSource>(initialData?.selectedModelSource || ModelSource.HuggingFace);
    const [modelSavePath, setModelSavePath] = useState(initialData?.modelSavePath || 'checkpoints');
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLog = (message: string) => {
        setDownloadLogs((prev) => [...prev, message]);
    };

    const ensureRepoConfigured = () => {
        if (!indexTtsRepoDir) {
            const msg = "IndexTTS repository directory is not set. Please finish the previous setup step first.";
            setError(msg);
            addLog(msg);
            return false;
        }
        return true;
    };

    const handleInstallTools = async () => {
        if (!ensureRepoConfigured()) {
            return;
        }

        addLog("Installing model download tools...");
        setError(null);
        setDownloading(true);

        try {
            addLog("Installing huggingface-hub[cli,hf_xet]...");
            const hfResult: string = await invoke('install_hf_or_modelscope_tools', {
                repoDir: indexTtsRepoDir,
                toolName: "huggingface-hub[cli,hf_xet]"
            });
            addLog(hfResult);
            setHfToolInstalled(true);

            addLog("Installing modelscope...");
            const msResult: string = await invoke('install_hf_or_modelscope_tools', {
                repoDir: indexTtsRepoDir,
                toolName: "modelscope"
            });
            addLog(msResult);
            setMsToolInstalled(true);

            addLog("Model download tools installed successfully.");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error installing model download tools: ${errMsg}`);
            setError(errMsg);
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadModel = async () => {
        if (!ensureRepoConfigured()) {
            return;
        }

        setDownloading(true);
        setError(null);
        setDownloadLogs([]);

        if (!hfToolInstalled || !msToolInstalled) {
            await handleInstallTools();
            if (!hfToolInstalled || !msToolInstalled) {
                setError("Failed to install model download tools. Cannot proceed.");
                setDownloading(false);
                return;
            }
        }

        addLog(`Attempting to download model from ${selectedModelSource === ModelSource.HuggingFace ? 'HuggingFace' : 'ModelScope'}...`);

        const useHfMirror = networkEnvironment === 'mainland_china' && selectedModelSource === ModelSource.HuggingFace;

        try {
            const downloadResult: string = await invoke('download_index_tts_model', {
                repoDir: indexTtsRepoDir,
                modelSource: selectedModelSource,
                useHfMirror: useHfMirror,
                modelSavePath: modelSavePath,
            });
            addLog(downloadResult);
            setModelDownloaded(true);
            addLog("Model downloaded successfully!");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error downloading model: ${errMsg}`);
            setError(errMsg);
        } finally {
            setDownloading(false);
        }
    };


    const handleNext = () => {
        onNext({ hfToolInstalled, msToolInstalled, modelDownloaded, downloadLogs, selectedModelSource, modelSavePath });
    };

    const repoReady = Boolean(indexTtsRepoDir);
    const installDisabled = downloading || !repoReady || (hfToolInstalled && msToolInstalled);
    const downloadDisabled = downloading || !repoReady || !hfToolInstalled || !msToolInstalled;
    const isNextDisabled = downloading || !modelDownloaded;


    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Download Model & Mirror Settings</h2>
            <p>Choose your preferred model source and download the IndexTTS2 model.</p>

            {!repoReady && (
                <div className="alert alert-warning">
                    请先完成 “IndexTTS Setup” 步骤并设置仓库路径，才能下载模型。
                </div>
            )}

            <button className="btn btn-primary" onClick={handleInstallTools} disabled={installDisabled}>
                {downloading ? 'Installing Tools...' : 'Install Model Download Tools'}
            </button>

            <div className="form-control">
                <label className="label">
                    <span className="label-text">Model Source:</span>
                </label>
                <select
                    className="select select-bordered w-full max-w-xs"
                    value={selectedModelSource}
                    onChange={(e) => setSelectedModelSource(e.target.value as ModelSource)}
                    disabled={downloading}
                >
                    <option value={ModelSource.HuggingFace}>HuggingFace (Recommended for Overseas)</option>
                    <option value={ModelSource.ModelScope}>ModelScope.cn (Recommended for Mainland China)</option>
                </select>
            </div>

            <div className="form-control">
                <label className="label">
                    <span className="label-text">Model Save Location (relative to repo dir):</span>
                </label>
                <input
                    type="text"
                    placeholder="e.g., checkpoints"
                    className="input input-bordered w-full"
                    value={modelSavePath}
                    onChange={(e) => setModelSavePath(e.target.value)}
                    disabled={downloading}
                />
            </div>

            <button className="btn btn-primary" onClick={handleDownloadModel} disabled={downloadDisabled}>
                {downloading ? 'Downloading...' : 'Download Model'}
            </button>

            {error && <div className="text-error-content bg-error p-2 rounded">{error}</div>}

            {downloadLogs.length > 0 && (
                <LogViewer logs={downloadLogs} />
            )}

            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={isNextDisabled}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default ModelDownloadStep;
