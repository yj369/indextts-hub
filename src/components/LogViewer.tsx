import React, { useRef, useEffect } from 'react';
import { Terminal, Activity } from 'lucide-react';

interface LogViewerProps {
    logs: string[];
    className?: string;
    title?: string;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, className, title = "SYSTEM LOGS" }) => {
    const logViewerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logViewerRef.current) {
            logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className={`rounded-xl border border-white/10 bg-black/80 overflow-hidden flex flex-col shadow-xl ${className || ''}`}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <Terminal className="w-3 h-3" />
                    <span className="tracking-widest uppercase">{title}</span>
                </div>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50 animate-pulse"></div>
                </div>
            </div>

            {/* Logs Content */}
            <div
                ref={logViewerRef}
                className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar relative"
            >
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[5] bg-[length:100%_2px,3px_100%] opacity-20"></div>

                {logs.length === 0 ? (
                    <div className="flex items-center gap-2 text-gray-600 italic opacity-50">
                        <Activity className="w-3 h-3" />
                        Waiting for input stream...
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className="break-all flex gap-2 group">
                            <span className="text-gray-600 select-none text-[10px] pt-[2px]">{(index + 1).toString().padStart(3, '0')}</span>
                            <span className={
                                log.toLowerCase().includes('error') ? 'text-red-400 crt-text' :
                                    log.toLowerCase().includes('success') ? 'text-green-400 crt-text' :
                                        'text-gray-300'
                            }>
                                {log}
                            </span>
                        </div>
                    ))
                )}
                {/* Blinking Cursor */}
                <div className="w-2 h-4 bg-primary/50 animate-pulse mt-1 inline-block"></div>
            </div>
        </div>
    );
};

export default LogViewer;