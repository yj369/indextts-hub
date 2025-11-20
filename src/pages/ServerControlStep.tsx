import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useWizard } from '../context/WizardContext';
import { openUrl } from '@tauri-apps/plugin-opener';
import { listen } from '@tauri-apps/api/event';
import LogViewer from '../components/LogViewer';
import { Button } from '../components/ui/button';
import { ServerStatus } from '../types/tauri';
import MagicCard from '../components/MagicCard';
import { Loader2, Power, ExternalLink, Play } from 'lucide-react';
import { cn } from '../lib/utils';

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

    useEffect(() => {
        const unlistenStdout = listen<string>('server-log-stdout', (e) => setServerLogs(p => [...p, `[OUT] ${e.payload}`]));
        const unlistenStderr = listen<string>('server-log-stderr', (e) => setServerLogs(p => [...p, `[ERR] ${e.payload}`]));
        return () => { unlistenStdout.then(f => f()); unlistenStderr.then(f => f()); };
    }, []);

    useEffect(() => {
        onNext({ serverStatus, serverLogs });
    }, [onNext, serverStatus, serverLogs]);

    const handleStartServer = async () => {
        setLoading(true);
        try {
            const status: ServerStatus = await invoke('start_index_tts_server', {
                repoDir: indexTtsRepoDir,
                hfEndpoint: networkEnvironment === 'mainland_china' ? 'https://hf-mirror.com' : undefined,
                useFp16,
                useDeepspeed,
            });
            setServerStatus(status);
        } catch (err) {
            setServerLogs(p => [...p, `[SYSTEM ERROR] ${err}`]);
            setServerStatus(ServerStatus.Error);
        } finally {
            setLoading(false);
        }
    };

    const handleStopServer = async () => {
        setLoading(true);
        try {
            const status: ServerStatus = await invoke('stop_index_tts_server');
            setServerStatus(status);
        } catch (err) {
            setServerLogs(p => [...p, `[SYSTEM ERROR] ${err}`]);
        } finally {
            setLoading(false);
        }
    };

    const isRunning = serverStatus === ServerStatus.Running;

    return (
        <div className="space-y-6">
            {/* Status Banner */}
            <MagicCard className="p-6 flex items-center justify-between border-white/10 bg-gradient-to-r from-black to-white/5">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                        isRunning ? "border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.4)]" : "border-red-500 bg-red-500/10"
                    )}>
                        <Power className={cn("w-6 h-6", isRunning ? "text-green-500" : "text-red-500")} />
                    </div>
                    <div>
                        <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">System Status</div>
                        <div className={cn("text-2xl font-black tracking-tight", isRunning ? "text-green-400" : "text-red-400")}>
                            {isRunning ? "ONLINE" : "OFFLINE"}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    {!isRunning ? (
                        <Button onClick={handleStartServer} disabled={loading} className="h-12 px-8 text-base bg-green-600 hover:bg-green-500 text-white border-green-400/30">
                            {loading ? <Loader2 className="animate-spin mr-2" /> : <Play className="mr-2 fill-current" />}
                            INITIALIZE
                        </Button>
                    ) : (
                        <>
                            <Button onClick={() => openUrl('http://127.0.0.1:7860')} className="h-12 px-6 bg-blue-600 hover:bg-blue-500 text-white border-blue-400/30">
                                <ExternalLink className="mr-2" /> OPEN WEBUI
                            </Button>
                            <Button onClick={handleStopServer} disabled={loading} variant="destructive" className="h-12 px-6">
                                <Power className="mr-2" /> SHUTDOWN
                            </Button>
                        </>
                    )}
                </div>
            </MagicCard>

            {/* Live Metrics (Visual Only for now) */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "CPU USAGE", val: isRunning ? "12%" : "0%", active: isRunning },
                    { label: "MEMORY", val: isRunning ? "2.4 GB" : "0 GB", active: isRunning },
                    { label: "UPTIME", val: isRunning ? "00:04:20" : "--:--:--", active: isRunning }
                ].map((metric, i) => (
                    <div key={i} className="p-3 rounded-lg border border-white/5 bg-black/40 flex flex-col items-center justify-center">
                        <div className="text-[10px] font-mono text-gray-600 mb-1">{metric.label}</div>
                        <div className={cn("text-xl font-bold font-mono", metric.active ? "text-white" : "text-gray-700")}>{metric.val}</div>
                    </div>
                ))}
            </div>

            {/* Console */}
            <div className="relative">
                <div className="absolute top-0 right-0 p-2 flex items-center gap-2 z-10">
                    <span className="flex h-2 w-2">
                      <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", isRunning ? "bg-green-400" : "bg-red-400")}></span>
                      <span className={cn("relative inline-flex rounded-full h-2 w-2", isRunning ? "bg-green-500" : "bg-red-500")}></span>
                    </span>
                    <span className="text-[10px] font-mono text-gray-500">LIVE STREAM</span>
                </div>
                <LogViewer logs={serverLogs} className="h-[300px]" title="SERVER CONSOLE" />
            </div>
        </div>
    );
};

export default ServerControlStep;
