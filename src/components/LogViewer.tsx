import React, { useRef, useEffect } from 'react';

interface LogViewerProps {
    logs: string[];
    className?: string;
}

const LogViewer: React.FC<LogViewerProps> = ({ logs, className }) => {
    const logViewerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Scroll to bottom of logs when new logs are added
        if (logViewerRef.current) {
            logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div
            ref={logViewerRef}
            className={`bg-base-300 p-4 rounded-md h-48 overflow-y-scroll font-mono text-sm ${className || ''}`}
        >
            {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
            ) : (
                logs.map((log, index) => (
                    <p key={index} className="whitespace-pre-wrap">{log}</p>
                ))
            )}
        </div>
    );
};

export default LogViewer;
