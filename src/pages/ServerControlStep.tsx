import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import LogViewer from '../components/LogViewer'; // Import LogViewer
import { ServerStatus } from '../types/tauri';

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

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Start/Stop IndexTTS2 Server</h2>
            <p>Control the IndexTTS2 WebUI server and view its logs.</p>

            <div className="card bg-base-200 shadow-md p-4">
                <h3 className="card-title">Server Status:</h3>
                <p>
                    {serverStatus === ServerStatus.Running && <span className="text-success">✅ Running</span>}
                    {serverStatus === ServerStatus.Stopped && <span className="text-error">🔴 Stopped</span>}
                    {serverStatus === ServerStatus.Error && <span className="text-error">❌ Error</span>}
                    {loading && <span className="ml-2 loading loading-spinner loading-sm"></span>}
                </p>
                <div className="flex gap-4 mt-4">
                    <button
                        className="btn btn-primary"
                        onClick={handleStartServer}
                        disabled={loading || serverStatus === ServerStatus.Running}
                    >
                        Start Server
                    </button>
                    <button
                        className="btn btn-warning"
                        onClick={handleStopServer}
                        disabled={loading || serverStatus === ServerStatus.Stopped}
                    >
                        Stop Server
                    </button>
                    <button
                        className="btn btn-info"
                        onClick={handleOpenWebUI}
                        disabled={loading || serverStatus !== ServerStatus.Running}
                    >
                        Open WebUI
                    </button>
                </div>
            </div>

            {error && <div className="text-error-content bg-error p-2 rounded">{error}</div>}

            {serverLogs.length > 0 && (
                <LogViewer logs={serverLogs} />
            )}

            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext} disabled={isNextDisabled}>
                    Finish
                </button>
            </div>
        </div>
    );
};

export default ServerControlStep;
