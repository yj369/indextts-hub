import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { Button } from '../components/ui/button';
import LogViewer from '../components/LogViewer';
import { ModelSource } from '../types/tauri';
import MagicCard from '../components/MagicCard';
import { Loader2, Download, Check, Cloud, Database, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

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

    // ... (Logic functions unchanged, assumed handleInstallTools, handleDownloadModel exist)
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
        if (!ensureRepoConfigured()) return;
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
            addLog("Tools installed successfully.");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error: ${errMsg}`);
            setError(errMsg);
        } finally {
            setDownloading(false);
        }
    };

    const handleDownloadModel = async () => {
        if (!ensureRepoConfigured()) return;
        setDownloading(true);
        setError(null);
        setDownloadLogs([]);

        if (!hfToolInstalled || !msToolInstalled) {
            await handleInstallTools();
            if (!hfToolInstalled || !msToolInstalled) {
                setError("Failed to install tools.");
                setDownloading(false);
                return;
            }
        }
        addLog(`Downloading from ${selectedModelSource}...`);
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
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error: ${errMsg}`);
            setError(errMsg);
        } finally {
            setDownloading(false);
        }
    };

    const handleNext = () => {
        onNext({ hfToolInstalled, msToolInstalled, modelDownloaded, downloadLogs, selectedModelSource, modelSavePath });
    };

    const isNextDisabled = downloading || !modelDownloaded;

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-5">
                {/* Configuration Side */}
                <div className="md:col-span-2 space-y-4">
                    <MagicCard className="p-4 space-y-4">
                        <div className="flex items-center gap-2 text-accent mb-2">
                            <Cloud className="w-4 h-4" />
                            <h3 className="text-xs font-bold uppercase tracking-widest">Model Source</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setSelectedModelSource(ModelSource.HuggingFace)}
                                className={cn(
                                    "p-3 rounded-lg border text-xs font-bold transition-all",
                                    selectedModelSource === ModelSource.HuggingFace
                                        ? "bg-primary/20 border-primary text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]"
                                        : "bg-black/40 border-white/10 text-gray-500 hover:bg-white/5"
                                )}
                            >
                                HuggingFace
                            </button>
                            <button
                                onClick={() => setSelectedModelSource(ModelSource.ModelScope)}
                                className={cn(
                                    "p-3 rounded-lg border text-xs font-bold transition-all",
                                    selectedModelSource === ModelSource.ModelScope
                                        ? "bg-secondary/20 border-secondary text-white shadow-[0_0_10px_rgba(45,212,191,0.3)]"
                                        : "bg-black/40 border-white/10 text-gray-500 hover:bg-white/5"
                                )}
                            >
                                ModelScope
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-mono text-gray-500 uppercase">Local Directory</label>
                            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg p-2">
                                <Database className="w-3 h-3 text-gray-500" />
                                <input
                                    type="text"
                                    value={modelSavePath}
                                    onChange={(e) => setModelSavePath(e.target.value)}
                                    className="bg-transparent border-none text-xs font-mono text-white w-full focus:ring-0"
                                />
                            </div>
                        </div>
                    </MagicCard>

                    <Button
                        onClick={handleDownloadModel}
                        disabled={downloading}
                        className="w-full py-6 text-base relative overflow-hidden group"
                        variant={modelDownloaded ? "secondary" : "default"}
                    >
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-[shimmer_2s_infinite] border-t border-white/20"></div>
                        <span className="relative flex items-center gap-2">
                            {downloading ? <Loader2 className="animate-spin" /> : modelDownloaded ? <Check /> : <Download />}
                            {downloading ? 'DOWNLOADING...' : modelDownloaded ? 'DOWNLOAD COMPLETE' : 'START DOWNLOAD'}
                         </span>
                    </Button>
                </div>

                {/* Logs Side */}
                <div className="md:col-span-3 h-full">
                    <LogViewer logs={downloadLogs} className="h-full min-h-[300px]" title="TRANSFER LOG" />
                </div>
            </div>

            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> {error}
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

export default ModelDownloadStep;
