import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import LogViewer from '../components/LogViewer';
import { ModelSource } from '../types/tauri';
import MagicCard from '../components/MagicCard';
import CipherRevealText from '../components/CipherRevealText';
import { Loader2, Play, Download as DownloadIcon, CheckCircle, XCircle, CloudDownload, AlertCircle } from 'lucide-react';

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
            // Attempt to install if not already
            await handleInstallTools();
            // Re-check after attempt
            if (!hfToolInstalled || !msToolInstalled) {
                setError("Failed to install model download tools. Cannot proceed with download.");
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
    const installToolsButtonDisabled = downloading || !repoReady || (hfToolInstalled && msToolInstalled);
    const downloadModelButtonDisabled = downloading || !repoReady || !hfToolInstalled || !msToolInstalled;
    const isNextDisabled = downloading || !modelDownloaded;


    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <CipherRevealText text="下载模型" className="text-2xl font-semibold" interval={80} />
                <p className="text-sm text-foreground/60">选择来源并保存到仓库。</p>
            </div>

            {!repoReady && (
                <MagicCard className="p-4 text-warning border-warning bg-warning/10 flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>先完成仓库配置再继续。</span>
                </MagicCard>
            )}

            <MagicCard className="p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                    <h3 className="font-semibold text-foreground/80 uppercase tracking-wide">下载工具</h3>
                    <Button onClick={handleInstallTools} disabled={installToolsButtonDisabled} className="px-4" size="sm">
                        {downloading && installToolsButtonDisabled ? (
                            <span className="flex items-center">
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 安装中
                            </span>
                        ) : (
                            <span className="flex items-center">
                                <Play className="w-4 h-4 mr-2" /> 安装工具
                            </span>
                        )}
                    </Button>
                </div>
                <ul className="list-none space-y-2 text-sm">
                    <li className="flex justify-between items-center">
                        <span>HuggingFace</span>
                        {hfToolInstalled ? (
                            <span className="flex items-center text-success">
                                <CheckCircle className="w-4 h-4 mr-2" /> 已安装
                            </span>
                        ) : (
                            <span className="flex items-center text-destructive">
                                <XCircle className="w-4 h-4 mr-2" /> 未安装
                            </span>
                        )}
                    </li>
                    <li className="flex justify-between items-center">
                        <span>ModelScope</span>
                        {msToolInstalled ? (
                            <span className="flex items-center text-success">
                                <CheckCircle className="w-4 h-4 mr-2" /> 已安装
                            </span>
                        ) : (
                            <span className="flex items-center text-destructive">
                                <XCircle className="w-4 h-4 mr-2" /> 未安装
                            </span>
                        )}
                    </li>
                </ul>
            </MagicCard>

            <MagicCard className="p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide flex items-center gap-2">
                    <CloudDownload className="w-4 h-4 text-secondary" /> 来源与路径
                </h3>
                <div className="space-y-4 text-sm">
                    <div>
                        <label htmlFor="model-source" className="block text-foreground/80 mb-1">
                            来源
                        </label>
                        <select
                            id="model-source"
                            className="w-full rounded-md border border-border bg-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedModelSource}
                            onChange={(e) => setSelectedModelSource(e.target.value as ModelSource)}
                            disabled={downloading}
                        >
                            <option value={ModelSource.HuggingFace}>HuggingFace（海外）</option>
                            <option value={ModelSource.ModelScope}>ModelScope（国内）</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="model-save-path" className="block text-foreground/80 mb-1">
                            保存目录（相对仓库）
                        </label>
                        <input
                            id="model-save-path"
                            type="text"
                            placeholder="如 checkpoints"
                            className="w-full rounded-md border border-border bg-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={modelSavePath}
                            onChange={(e) => setModelSavePath(e.target.value)}
                            disabled={downloading}
                        />
                         <p className="text-xs text-foreground/60 mt-1">
                            {indexTtsRepoDir}/{modelSavePath}
                        </p>
                    </div>
                </div>
            </MagicCard>

            <div className="flex justify-center">
                <Button onClick={handleDownloadModel} disabled={downloadModelButtonDisabled} className="px-6">
                    {downloading && downloadModelButtonDisabled ? (
                        <span className="flex items-center">
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> 下载中
                        </span>
                    ) : (
                        <span className="flex items-center">
                            <DownloadIcon className="w-4 h-4 mr-2" /> 下载
                        </span>
                    )}
                </Button>
            </div>

            {modelDownloaded && (
                <MagicCard className="p-4 bg-success/10 border-success/60 text-success flex items-center gap-2 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span>模型就绪</span>
                </MagicCard>
            )}

            {error && (
                <MagicCard className="p-4 bg-destructive/10 border-destructive/50 text-destructive flex items-center gap-2 text-sm">
                    <XCircle className="w-4 h-4" />
                    <span>{error}</span>
                </MagicCard>
            )}

            {downloadLogs.length > 0 && (
                <LogViewer logs={downloadLogs} />
            )}

            <div className="flex justify-end pt-4">
                <Button onClick={handleNext} disabled={isNextDisabled}>
                    继续
                </Button>
            </div>
        </div>
    );
};

export default ModelDownloadStep;
