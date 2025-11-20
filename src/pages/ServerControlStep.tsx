import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import { ServerStatus } from '../types/tauri';
import { Loader2, Play, Square, CheckCircle, XCircle, ExternalLink } from 'lucide-react';

interface ServerControlStepProps {
    onNext: (data: ServerControlStepData) => void;
    initialData?: ServerControlStepData;
}

export interface ServerControlStepData {
    serverStatus: ServerStatus;
    serverLogs: string[];
}

const ServerControlStep: React.FC<ServerControlStepProps> = ({ onNext, initialData }) => {
    const { indexTtsRepoDir, networkEnvironment, useFp16, useDeepspeed } = useWizard();
    const [serverStatus, setServerStatus] = useState<ServerStatus>(initialData?.serverStatus || ServerStatus.Stopped);
    const [serverLogs, setServerLogs] = useState<string[]>(initialData?.serverLogs || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addLog = (message: string) => {
        setServerLogs((prev) => [...prev, message]);
    };

    useEffect(() => {
        // Listen for server logs from the backend
        const unlistenStdout = listen<string>('server-log-stdout', (event) => {
            addLog(`[STDOUT] ${event.payload}`);
        });
        const unlistenStderr = listen<string>('server-log-stderr', (event) => {
            addLog(`[STDERR] ${event.payload}`);
        });

        // Check initial server status
        const checkStatus = async () => {
            try {
                const status: ServerStatus = await invoke('get_server_status');
                setServerStatus(status);
            } catch (err) {
                console.error("Failed to get initial server status:", err);
            }
        };
        checkStatus();

        return () => {
            unlistenStdout.then(f => f());
            unlistenStderr.then(f => f());
        };
    }, []);


    const handleStartServer = async () => {
        setLoading(true);
        setError(null);
        setServerLogs([]);

        if (!indexTtsRepoDir) {
            setError("IndexTTS repository directory is not set. Please complete previous steps.");
            setLoading(false);
            return;
        }

        const hfEndpoint = networkEnvironment === 'mainland_china' ? 'https://hf-mirror.com' : undefined;

        addLog("Starting IndexTTS2 server...");
        try {
            const status: ServerStatus = await invoke('start_index_tts_server', {
                repoDir: indexTtsRepoDir,
                hfEndpoint: hfEndpoint,
                useFp16: useFp16,
                useDeepspeed: useDeepspeed,
            });
            setServerStatus(status);
            addLog("Server started successfully.");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error starting server: ${errMsg}`);
            setError(errMsg);
            setServerStatus(ServerStatus.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleStopServer = async () => {
        setLoading(true);
        setError(null);
        addLog("Stopping IndexTTS2 server...");
        try {
            const status: ServerStatus = await invoke('stop_index_tts_server');
            setServerStatus(status);
            addLog("Server stopped.");
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error stopping server: ${errMsg}`);
            setError(errMsg);
            setServerStatus(ServerStatus.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenWebUI = async () => {
        addLog("Opening WebUI in browser...");
        try {
            await openUrl('http://127.0.0.1:7860');
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            addLog(`Error opening WebUI: ${errMsg}`);
            setError(errMsg);
        }
    };

    const handleNext = () => {
        onNext({ serverStatus, serverLogs });
    };

    const isNextDisabled = loading;

    const renderServerStatus = () => {
        switch (serverStatus) {
            case ServerStatus.Running:
                return (
                    <span className="flex items-center text-success text-base font-semibold">
                        <CheckCircle className="w-5 h-5 mr-2" /> 运行中
                    </span>
                );
            case ServerStatus.Stopped:
                return (
                    <span className="flex items-center text-destructive text-base font-semibold">
                        <Square className="w-5 h-5 mr-2" /> 已停止
                    </span>
                );
            case ServerStatus.Error:
                return (
                    <span className="flex items-center text-error text-base font-semibold">
                        <XCircle className="w-5 h-5 mr-2" /> 异常
                    </span>
                );
            default:
                return (
                    <span className="flex items-center text-gray-500 text-base font-semibold">
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" /> 未知
                    </span>
                );
        }
    };

    return (
        <div className="space-y-4 text-sm text-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
                <div>
                    <h2 className="text-lg font-semibold">服务控制</h2>
                    <p className="text-xs text-foreground/60">IndexTTS 服务状态与日志</p>
                </div>
                <div className="text-sm font-semibold text-primary/80">{renderServerStatus()}</div>
            </div>

            <div className="flex flex-wrap gap-2">
                <Button
                    size="sm"
                    onClick={handleStartServer}
                    disabled={loading || serverStatus === ServerStatus.Running}
                    className="gap-2"
                >
                    {loading && serverStatus !== ServerStatus.Stopped ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="h-4 w-4" />
                    )}
                    启动
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleStopServer}
                    disabled={loading || serverStatus === ServerStatus.Stopped}
                    className="gap-2"
                >
                    {loading && serverStatus !== ServerStatus.Running ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Square className="h-4 w-4" />
                    )}
                    停止
                </Button>
                <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleOpenWebUI}
                    disabled={loading || serverStatus !== ServerStatus.Running}
                    className="gap-2"
                >
                    <ExternalLink className="h-4 w-4" /> WebUI
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive">
                    <XCircle className="w-4 h-4" />
                    <span>{error}</span>
                </div>
            )}

            <div className="rounded-2xl bg-background/85 p-3">
                <LogViewer logs={serverLogs} className="h-40" />
            </div>

            <div className="flex justify-end">
                <Button onClick={handleNext} disabled={isNextDisabled} size="sm">
                    完成
                </Button>
            </div>
        </div>
    );
};

export default ServerControlStep;
