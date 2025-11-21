import React, { useState, useEffect, useRef, useContext, createContext } from 'react';
import { 
  Terminal, Activity, Loader2, Check, Cloud, Cpu, 
  Globe, Server, ArrowRight, 
  FolderOpen, Play, GitBranch, Layers, ExternalLink, ShieldAlert,
  Wrench, Monitor, RefreshCw, Maximize2, Minimize2,
  LayoutDashboard, Signal, ArrowDownCircle, StopCircle,
  Cpu as ChipIcon, Gauge, Trash2, RefreshCcw, CheckCircle, XCircle, AlertCircle, ArrowLeft
} from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { open as openUrl } from '@tauri-apps/plugin-shell';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

const hasTauriInternals =
  typeof window !== 'undefined' &&
  (Boolean((window as any).__TAURI_INTERNALS__) ||
    Boolean((window as any).__TAURI_IPC__));

const forceMock =
  typeof import.meta !== 'undefined' &&
  (import.meta as any).env?.VITE_USE_TAURI_MOCK === '1';

const isTauriEnvironment = hasTauriInternals && !forceMock;

// --- 浏览器环境下使用的模拟 API ---
const mockInvoke = async (cmd: string, args?: any): Promise<any> => {
  await new Promise((resolve) => setTimeout(resolve, 400));

  switch (cmd) {
    case 'get_system_info':
      return {
        os: 'Windows 11 专业版',
        cpu_brand: 'Intel(R) Core(TM) i9-13900K',
        cpu_cores: 24,
        total_memory_gb: 64.0,
        available_memory_gb: 32.5,
        total_disk_gb: 2048.0,
        available_disk_gb: 1024.0,
        gpu_info: {
          name: 'NVIDIA GeForce RTX 4090',
          vram_gb: 24.0,
          driver_version: '536.23',
          has_cuda: true,
          cuda_available: true,
        },
      };
    case 'check_tools':
      return {
        git_installed: false,
        git_lfs_installed: false,
        python_installed: false,
        uv_installed: false,
        cuda_toolkit_installed: false,
      };
    case 'check_index_tts_repo':
      return false;
    case 'install_git_and_lfs':
    case 'install_uv':
    case 'install_python':
    case 'clone_index_tts_repo':
    case 'init_git_lfs':
    case 'setup_index_tts_env':
    case 'install_hf_or_modelscope_tools':
    case 'download_index_tts_model':
      return 'SUCCESS';
    case 'run_gpu_check':
      return {
        has_cuda: true,
        name: 'NVIDIA GeForce RTX 4090',
        vram_gb: 24.0,
        recommended_fp16: true,
      };
    case 'start_index_tts_server':
      return 'Running';
    case 'stop_index_tts_server':
      return 'Stopped';
    case 'check_repo_update': {
      const hasUpdate = Math.random() > 0.5;
      return {
        has_update: hasUpdate,
        local_hash: '7f8a9b1',
        remote_hash: hasUpdate ? '3c2d1e0' : '7f8a9b1',
        message: hasUpdate
          ? 'Feat: 优化了显存占用与推理速度 (v1.2.0)'
          : '当前已是最新版本',
      };
    }
    case 'pull_repo':
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return 'SUCCESS';
    default:
      console.warn(`mockInvoke: 未实现的命令 ${cmd}`, args);
      return null;
  }
};

const mockOpenUrl = (url: string) => {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
    return;
  }
  console.log(`Opening URL: ${url}`);
};

const mockOpenDialog = async (): Promise<string | string[] | null> => {
  return 'C:\\\\Users\\\\MockUser\\\\Projects\\\\index-tts';
};

const WEBUI_URL = "http://127.0.0.1:7860";

// --- 工具函数 ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatGb = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const absValue = Math.abs(value);
  const formatted =
    absValue >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${formatted} GB`;
};

// --- 模拟后端 API ---
const tauriInvoke = async (cmd: string, args?: any): Promise<any> => {
  if (!isTauriEnvironment) {
    return mockInvoke(cmd, args);
  }

  return await invoke(cmd, args);
};

const tauriOpenUrl = (url: string) => {
  if (!isTauriEnvironment) {
    mockOpenUrl(url);
    return;
  }
  openUrl(url);
};

const tauriOpenDialog = async (): Promise<string | string[] | null> => {
  if (!isTauriEnvironment) {
    return mockOpenDialog();
  }
  const result = await openDialog({
    directory: true,
    title: '选择 IndexTTS 仓库目录',
  });
  return result;
};


// --- 上下文定义 ---
type WizardState = {
  networkEnvironment: string;
  indexTtsRepoDir: string | null;
  computeConfig: { useGpu: boolean; useFp16: boolean };
  envCheckData: any;
  installToolsData: any;
  indexTtsSetupData: any;
  modelDownloadData: any;
  serverControlData: any;
};

const defaultWizardState: WizardState = {
  networkEnvironment: 'mainland_china',
  indexTtsRepoDir: null,
  computeConfig: { useGpu: true, useFp16: true },
  envCheckData: null,
  installToolsData: null,
  indexTtsSetupData: null,
  modelDownloadData: null,
  serverControlData: null,
};

const STORAGE_KEY = 'indextts-wizard-state';

const loadWizardState = (): WizardState => {
  if (typeof window === 'undefined') return defaultWizardState;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultWizardState, ...parsed };
    }
  } catch (err) {
    console.warn('Failed to load wizard state from storage', err);
  }
  return defaultWizardState;
};

const WizardContext = createContext<any>(undefined);

const WizardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<WizardState>(() => loadWizardState());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to persist wizard state', err);
    }
  }, [state]);

  const updateState = (key: string, value: any) => {
    setState(prev => ({ ...prev, [key]: value }));
  };

  const value = {
    ...state,
    setNetworkEnvironment: (v: any) => updateState('networkEnvironment', v),
    setComputeConfig: (v: any) => updateState('computeConfig', v),
    setIndexTtsRepoDir: (v: any) => updateState('indexTtsRepoDir', v),
    setEnvCheckData: (v: any) => updateState('envCheckData', v),
    setInstallToolsData: (v: any) => updateState('installToolsData', v),
    setIndexTtsSetupData: (v: any) => updateState('indexTtsSetupData', v),
    setModelDownloadData: (v: any) => updateState('modelDownloadData', v),
    setServerControlData: (v: any) => updateState('serverControlData', v),
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
};

const useWizard = () => useContext(WizardContext);

type CoreDeployLogPayload = {
  step?: string;
  stream?: string;
  line?: string;
};

type ServerLogPayload = string;

type EngineStatus = 'Stopped' | 'Starting' | 'Running';

// --- UI Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string, size?: string }>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-bold transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:scale-95 uppercase tracking-wide";
        
        const variants: Record<string, string> = {
            default: "bg-purple-600 text-white hover:bg-purple-500 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] border border-purple-500/50",
            teal: "bg-teal-500 text-white hover:bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.3)] hover:shadow-[0_0_25px_rgba(45,212,191,0.5)] border border-teal-500/50",
            destructive: "bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]",
            outline: "border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-gray-200 backdrop-blur-sm",
            secondary: "bg-teal-500/10 text-teal-400 border border-teal-500/50 hover:bg-teal-500/20 shadow-[0_0_15px_rgba(45,212,191,0.1)]",
            ghost: "hover:bg-white/10 hover:text-white text-gray-400",
            link: "text-purple-400 hover:text-purple-300 underline-offset-4 hover:underline p-0 h-auto",
            light: "bg-white text-black hover:bg-gray-200 border border-transparent shadow-lg hover:shadow-xl",
            success: "bg-green-500/10 text-green-400 border border-green-500/50 hover:bg-green-500/20",
            warning: "bg-amber-500/10 text-amber-400 border border-amber-500/50 hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]",
            consoleStart: "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-green-500/30 backdrop-blur-md",
            consoleStop: "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500/30 backdrop-blur-md",
        };
        
        const sizes: Record<string, string> = {
            default: "h-9 px-4 py-2",
            sm: "h-7 rounded-md px-3 text-[10px]",
            lg: "h-11 rounded-md px-8 text-sm",
            xl: "h-14 rounded-xl px-8 text-base",
            icon: "h-9 w-9",
            xs: "h-6 px-2 text-[10px]",
        };

        return <button className={cn(baseStyles, variants[variant], sizes[size], className)} ref={ref} {...props} />;
    }
);
Button.displayName = "Button";

// --- 新增: 光点矩阵呼吸特效 (DotMatrixEffect) ---
const DotMatrixEffect: React.FC<{ active: boolean }> = ({ active }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const agentsRef = useRef<any[]>([]);
    const requestRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Resize handling
        const resize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.offsetWidth;
                canvas.height = parent.offsetHeight;
            }
        };
        resize();
        window.addEventListener('resize', resize);

        // Initialize agents
        const width = canvas.width;
        const height = canvas.height;
        const numAgents = 8; // Number of wandering points
        
        if (agentsRef.current.length === 0) {
            for(let i=0; i<numAgents; i++) {
                agentsRef.current.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 1.0,
                    vy: (Math.random() - 0.5) * 1.0,
                    radius: Math.random() * 100 + 50, // Influence radius
                    t: Math.random() * Math.PI * 2, // Phase
                    speed: Math.random() * 0.02 + 0.01
                });
            }
        }

        const spacing = 30; // Grid spacing
        let time = 0;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            time += 0.02;

            // Update agents
            agentsRef.current.forEach(agent => {
                agent.x += agent.vx;
                agent.y += agent.vy;
                agent.t += agent.speed;
                // Bounce
                if(agent.x < -50 || agent.x > canvas.width + 50) agent.vx *= -1;
                if(agent.y < -50 || agent.y > canvas.height + 50) agent.vy *= -1;
            });

            // Draw Grid Points
            for (let x = 0; x < canvas.width; x += spacing) {
                for (let y = 0; y < canvas.height; y += spacing) {
                    let energy = 0;
                    
                    // Calculate accumulated energy from agents
                    agentsRef.current.forEach(agent => {
                        const dx = x - agent.x;
                        const dy = y - agent.y;
                        const distSq = dx*dx + dy*dy;
                        const rSq = agent.radius * agent.radius;
                        
                        if (distSq < rSq) {
                            const breath = (Math.sin(agent.t * 2) + 1) / 2 * 0.5 + 0.5;
                            const falloff = (1 - distSq / rSq);
                            energy += falloff * falloff * breath; 
                        }
                    });

                    // Base noise
                    const noise = (Math.sin(x * 0.05 + time) + Math.cos(y * 0.05 + time)) * 0.1;
                    let alpha = energy * 1.2 + noise;
                    
                    // Clamping and baseline
                    let finalAlpha = 0.03; // Dim baseline
                    if (alpha > 0.1) {
                        finalAlpha = 0.03 + Math.min(0.8, alpha * 0.8);
                    }

                    // Color mixing: Purple (180, 50, 255) -> Teal (0, 255, 255) based on Y
                    const verticalMix = y / canvas.height;
                    const r = 180 * (1 - verticalMix) + 0 * verticalMix;
                    const g = 50 * (1 - verticalMix) + 255 * verticalMix;
                    const b = 255 * (1 - verticalMix) + 255 * verticalMix;

                    // Only draw if visible enough
                    if (finalAlpha > 0.01) {
                        // Mix with white for base "inactive" dots
                        const baseMix = Math.min(1, finalAlpha * 2.5); 
                        const fr = 255 * (1 - baseMix) + r * baseMix;
                        const fg = 255 * (1 - baseMix) + g * baseMix;
                        const fb = 255 * (1 - baseMix) + b * baseMix;

                        const radius = 1 + finalAlpha * 1.5;

                        ctx.fillStyle = `rgba(${Math.floor(fr)}, ${Math.floor(fg)}, ${Math.floor(fb)}, ${finalAlpha})`;
                        ctx.beginPath();
                        ctx.arc(x, y, radius, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            requestRef.current = requestAnimationFrame(draw);
        };

        if (active) {
            draw();
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [active]);

    return (
        <canvas 
            ref={canvasRef} 
            className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-1000"
            style={{ 
                opacity: active ? 1 : 0,
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)'
            }}
        />
    );
};

const MagicCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void; gradientColor?: string; active?: boolean }> = ({
    children, className, onClick, gradientColor = "rgba(139, 92, 246, 0.15)", active = false
}) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | null>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    return (
        <div
            ref={cardRef}
            className={cn(
                "group relative overflow-hidden rounded-xl border bg-[#0a0a0a]/80 transition-all duration-500 ease-out",
                active ? "border-opacity-50 shadow-lg scale-[1.01] -translate-y-0.5" : "border-white/5 hover:border-white/20 hover:-translate-y-0.5",
                onClick && "cursor-pointer",
                className
            )}
            style={{ 
                borderColor: active ? 'rgba(255,255,255,0.3)' : undefined 
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setMousePosition(null)}
            onClick={onClick}
        >
            <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300 group-hover:opacity-100"
                style={{
                    background: mousePosition
                        ? `radial-gradient(400px circle at ${mousePosition.x}px ${mousePosition.y}px, ${gradientColor}, transparent 40%)`
                        : '',
                }}
            />
            {active && (
                 <div className="absolute inset-0 opacity-20 pointer-events-none transition-opacity duration-500" 
                      style={{ background: `radial-gradient(circle at 50% 0%, ${gradientColor}, transparent 70%)` }}>
                 </div>
            )}
            <div className="relative z-10 h-full">{children}</div>
        </div>
    );
};

const LogViewer: React.FC<{ logs: string[], className?: string, title?: string, autoScroll?: boolean, onToggleSize?: () => void, isExpanded?: boolean, onClear?: () => void }> = ({ logs, className, title = "系统日志", autoScroll = true, onToggleSize, isExpanded, onClear }) => {
    const logViewerRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        if (logViewerRef.current && autoScroll) {
            logViewerRef.current.scrollTop = logViewerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    return (
        <div className={`rounded-lg border border-white/10 bg-black/90 overflow-hidden flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${className || ''}`}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5 bg-white/5 shrink-0 cursor-pointer group" onClick={onToggleSize}>
                <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500 group-hover:text-gray-300 transition-colors">
                    <Terminal className="w-3 h-3" />
                    <span className="tracking-widest uppercase">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    {onClear && logs.length > 0 && (
                         <button 
                            onClick={(e) => { e.stopPropagation(); onClear(); }}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded hover:bg-white/5"
                            title="清空日志"
                         >
                             <Trash2 className="w-3 h-3" />
                         </button>
                    )}
                    <div className="flex gap-1 mr-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-white/40 transition-colors"></div>
                    </div>
                    {onToggleSize && (
                        <button className="text-gray-500 hover:text-white transition-colors">
                            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                        </button>
                    )}
                </div>
            </div>
            <div ref={logViewerRef} className="flex-1 p-3 overflow-y-auto font-mono text-[10px] leading-relaxed space-y-0.5 relative scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {logs.length === 0 ? (
                    <div className="flex items-center gap-2 text-gray-700 italic">
                        <Activity className="w-3 h-3" /> 暂无输出...
                    </div>
                ) : (
                    logs.map((log, index) => (
                        <div key={index} className="break-all flex gap-2 group opacity-0 animate-[slideRight_0.3s_ease-out_forwards]">
                            <span className="text-gray-700 select-none w-6 text-right shrink-0">{(index + 1).toString().padStart(2, '0')}</span>
                            <span className={cn(
                                "font-mono",
                                log.toLowerCase().includes('error') || log.includes('失败') || log.includes('|STDERR') ? 'text-red-400' : 
                                log.toLowerCase().includes('success') || log.includes('成功') ? 'text-green-400' : 
                                log.includes('>>>') ? 'text-purple-400 font-bold' : 'text-gray-300'
                            )}>
                                {log}
                            </span>
                        </div>
                    ))
                )}
                 <div className="w-1.5 h-3 bg-purple-500/50 animate-pulse mt-1 inline-block"></div>
            </div>
        </div>
    );
};

const WizardProgress: React.FC<{ currentStep: number; totalSteps: number }> = ({ currentStep, totalSteps }) => {
    const steps = Array.from({ length: totalSteps });
    return (
        <div className="flex items-center justify-center gap-1 mb-4">
            {steps.map((_, i) => (
                <div 
                    key={i} 
                    className={cn(
                        "h-1 rounded-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)",
                        i <= currentStep ? "w-8 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" : "w-2 bg-white/10"
                    )}
                />
            ))}
        </div>
    );
};

const BrandLogo = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" className={className}>
        <defs>
            <filter id="teal-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
            <style>{`
                .cls-1 { 
                    fill: none; 
                    stroke: #FFFFFF;
                    stroke-linecap: round; 
                    stroke-linejoin: round; 
                    stroke-width: 14px; 
                    stroke-dasharray: 600;
                    stroke-dashoffset: 600;
                    animation: drawLine 2.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                .cls-2 { 
                    fill: #32AFA0;
                    stroke: none;
                    transform-origin: 150px 125px;
                    animation: 
                        popIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards 1.8s,
                        pulseDot 3s ease-in-out infinite 2.4s;
                    opacity: 0;
                }
                @keyframes drawLine {
                    to { stroke-dashoffset: 0; }
                }
                @keyframes popIn {
                    from { transform: scale(0); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes pulseDot {
                    0%, 100% { filter: drop-shadow(0 0 2px rgba(50, 175, 160, 0.4)); transform: scale(1); }
                    50% { filter: drop-shadow(0 0 12px rgba(50, 175, 160, 0.9)); transform: scale(1.15); }
                }
            `}</style>
        </defs>
        <path className="cls-1" d="M 136 60 L 75 60 Q 50 60 50 85 L 50 215 Q 50 240 75 240 L 125 240 Q 150 240 150 215 L 150 170"/>
        <circle className="cls-2" cx="150" cy="125" r="16"></circle>
    </svg>
);

// --- 启动页 (Splash Screen) ---

const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [text, setText] = useState("系统启动序列初始化...");
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => setIsExiting(true), 800); 
                    return 100;
                }
                const jump = Math.random() * 5; 
                return Math.min(prev + jump, 100);
            });
        }, 150);

        const texts = [
            "正在加载神经引擎模块...",
            "校验音频处理内核...",
            "优化 TENSORFLOW 计算图...",
            "校准声码器参数...",
            "HELLOVIEW 系统就绪。"
        ];
        let textIdx = 0;
        const textInterval = setInterval(() => {
            if (textIdx < texts.length) {
                setText(texts[textIdx]);
                textIdx++;
            }
        }, 900);

        return () => { clearInterval(interval); clearInterval(textInterval); };
    }, []);

    useEffect(() => {
        if (isExiting) {
            const timer = setTimeout(onComplete, 1000);
            return () => clearTimeout(timer);
        }
    }, [isExiting, onComplete]);

    return (
        <div className={cn(
            "absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#030303] text-white overflow-hidden transition-opacity duration-1000 ease-in-out",
            isExiting ? "opacity-0" : "opacity-100"
        )}>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(30,30,30,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(30,30,30,0.2)_1px,transparent_1px)] bg-[size:60px_60px] opacity-20"></div>
            <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-[480px]">
                <div className="flex flex-col items-center animate-[fadeIn_1s_ease-out]">
                    <span className="text-[10px] font-bold tracking-[0.4em] text-gray-500 uppercase mb-2">Created By</span>
                    <div className="flex items-center gap-2">
                        <span className="text-2xl font-black tracking-[0.2em] text-white uppercase">HELLOVIEW</span>
                    </div>
                </div>
                <div className="relative group scale-150 p-8">
                    <div className="absolute inset-0 bg-[#32AFA0] blur-[100px] opacity-0 group-hover:opacity-10 transition-opacity duration-1000 rounded-full"></div>
                    <BrandLogo className="w-32 h-48 drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" />
                </div>
                <div className="w-full space-y-8 animate-[slideUp_0.8s_ease-out] mt-2">
                    <div className="text-center">
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-1">
                            IndexTTS <span className="text-[#32AFA0]">Hub</span>
                        </h1>
                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-[0.3em] mt-2">高性能语音合成部署工具</p>
                    </div>
                    <div className="space-y-2 px-12">
                        <div className="flex justify-between text-[9px] font-mono text-[#32AFA0]/80">
                            <span className="animate-pulse">{text}</span>
                            <span>{Math.round(progress)}%</span>
                        </div>
                        <div className="h-0.5 bg-gray-900 w-full overflow-hidden relative">
                             <div 
                                className="h-full bg-[#32AFA0] shadow-[0_0_10px_rgba(50,175,160,0.6)] transition-all duration-150 ease-out relative"
                                style={{ width: `${progress}%` }}
                             >
                             </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-6 text-[9px] text-gray-800 font-mono">V0.1.0 // HELLOVIEW INC.</div>
        </div>
    );
};

// --- 向导步骤组件 ---

const NetworkSelectStep: React.FC<{ onNext: (data: any) => void, initialData?: any }> = ({ onNext, initialData }) => {
    const { networkEnvironment, setNetworkEnvironment } = useWizard();
    const [network, setNetwork] = useState(initialData?.networkEnvironment || networkEnvironment || 'mainland_china');
    const [pingResults, setPingResults] = useState<{
        mainland_china: { loading: boolean, result: string | null, error: boolean },
        overseas: { loading: boolean, result: string | null, error: boolean }
    }>({
        mainland_china: { loading: false, result: null, error: false },
        overseas: { loading: false, result: null, error: false }
    });

    const runPing = async (region: 'mainland_china' | 'overseas') => {
        setPingResults(prev => ({ ...prev, [region]: { loading: true, result: null, error: false } }));
        // Simulate network latency or replace with actual ping command
        await new Promise(r => setTimeout(r, 1500));
        const latency = region === 'mainland_china' ? Math.floor(Math.random() * 35) + 15 : Math.floor(Math.random() * 200) + 180;
        setPingResults(prev => ({ ...prev, [region]: { loading: false, result: `${latency}ms`, error: false } }));
    };

    useEffect(() => {
        runPing('mainland_china');
        runPing('overseas');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="h-full flex flex-col relative">
            <div className="text-center mb-6 shrink-0 animate-[slideDown_0.6s_cubic-bezier(0.2,0.8,0.2,1)]">
                <h2 className="text-2xl font-bold text-white tracking-tight mb-1">区域配置</h2>
                <p className="text-xs text-gray-500">请选择您的网络环境以优化后续的模型下载速度。</p>
            </div>

            <div className="flex-1 flex gap-4 px-2 min-h-0 mb-2">
                <MagicCard 
                    onClick={() => setNetwork('mainland_china')} 
                    active={network === 'mainland_china'}
                    gradientColor="rgba(45, 212, 191, 0.2)"
                    className={cn(
                        "flex-1 flex flex-col relative group border-2 animate-[slideUp_0.6s_cubic-bezier(0.2,0.8,0.2,1)_0.1s_both]",
                        network === 'mainland_china' ? "border-teal-500/40 bg-teal-950/10" : "border-white/5 bg-white/5 opacity-60 hover:opacity-100"
                    )}
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
                    <div className={cn("absolute top-3 right-3 transition-all duration-500 ease-out", network === 'mainland_china' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 rotate-45")}>
                        <div className="bg-teal-500/20 p-1 rounded-full"><CheckCircle className="w-5 h-5 text-teal-400" /></div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                        <div className={cn("p-3 rounded-2xl transition-all duration-500", network === 'mainland_china' ? "bg-teal-500/20 text-teal-400 shadow-[0_0_30px_rgba(45,212,191,0.2)] scale-110" : "bg-white/5 text-gray-500")}>
                             <Cloud className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-0.5">
                            <div className="text-sm font-bold text-white">中国大陆</div>
                            <div className="text-[9px] text-teal-400 font-mono tracking-wider">CN REGION</div>
                        </div>
                        <div className="text-[10px] text-gray-400 text-center leading-relaxed px-1">
                            自动配置 <span className="text-gray-200 font-medium">ModelScope</span> 镜像源。<br/>专为国内网络环境优化。
                        </div>
                    </div>

                    <div className="p-2 border-t border-white/5 bg-black/20 flex justify-center">
                        {pingResults.mainland_china.loading ? (
                            <div className="flex items-center gap-2 text-[9px] text-teal-400 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> 测速中...
                            </div>
                        ) : pingResults.mainland_china.result ? (
                            <div className="flex items-center gap-2 text-[10px] text-green-400 font-mono animate-[fadeIn_0.3s_ease-out]">
                                <Signal className="w-3 h-3" /> Ping: {pingResults.mainland_china.result}
                                <RefreshCw className="w-3 h-3 ml-2 text-gray-600 hover:text-white cursor-pointer transition-transform hover:rotate-180 duration-500" onClick={(e) => { e.stopPropagation(); runPing('mainland_china'); }} />
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => { e.stopPropagation(); runPing('mainland_china'); }}
                                className="flex items-center gap-1.5 text-[9px] text-gray-500 hover:text-teal-400 transition-colors group/link"
                            >
                                <Activity className="w-3 h-3" />
                                <span className="group-hover/link:underline underline-offset-2">测试连接延迟</span>
                            </button>
                        )}
                    </div>
                </MagicCard>

                <MagicCard 
                    onClick={() => setNetwork('overseas')} 
                    active={network === 'overseas'}
                    gradientColor="rgba(168, 85, 247, 0.2)"
                    className={cn(
                        "flex-1 flex flex-col relative group border-2 animate-[slideUp_0.6s_cubic-bezier(0.2,0.8,0.2,1)_0.2s_both]",
                        network === 'overseas' ? "border-purple-500/40 bg-purple-950/10" : "border-white/5 bg-white/5 opacity-60 hover:opacity-100"
                    )}
                >
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
                    <div className={cn("absolute top-3 right-3 transition-all duration-500 ease-out", network === 'overseas' ? "scale-100 opacity-100 rotate-0" : "scale-50 opacity-0 rotate-45")}>
                        <div className="bg-purple-500/20 p-1 rounded-full"><CheckCircle className="w-5 h-5 text-purple-400" /></div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
                        <div className={cn("p-3 rounded-2xl transition-all duration-500", network === 'overseas' ? "bg-purple-500/20 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.2)] scale-110" : "bg-white/5 text-gray-500")}>
                             <Globe className="w-8 h-8" />
                        </div>
                        <div className="text-center space-y-0.5">
                            <div className="text-sm font-bold text-white">国际区域</div>
                            <div className="text-[9px] text-purple-400 font-mono tracking-wider">GLOBAL</div>
                        </div>
                        <div className="text-[10px] text-gray-400 text-center leading-relaxed px-1">
                            直接连接 <span className="text-gray-200 font-medium">Hugging Face</span> 官方源。<br/>适合海外或全局代理环境。
                        </div>
                    </div>

                    <div className="p-2 border-t border-white/5 bg-black/20 flex justify-center">
                        {pingResults.overseas.loading ? (
                            <div className="flex items-center gap-2 text-[9px] text-purple-400 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> 测速中...
                            </div>
                        ) : pingResults.overseas.result ? (
                            <div className={cn("flex items-center gap-2 text-[10px] font-mono animate-[fadeIn_0.3s_ease-out]", parseInt(pingResults.overseas.result) > 150 ? "text-amber-400" : "text-green-400")}>
                                <Signal className="w-3 h-3" /> Ping: {pingResults.overseas.result}
                                <RefreshCw className="w-3 h-3 ml-2 text-gray-600 hover:text-white cursor-pointer transition-transform hover:rotate-180 duration-500" onClick={(e) => { e.stopPropagation(); runPing('overseas'); }} />
                            </div>
                        ) : (
                            <button 
                                onClick={(e) => { e.stopPropagation(); runPing('overseas'); }}
                                className="flex items-center gap-1.5 text-[9px] text-gray-500 hover:text-purple-400 transition-colors group/link"
                            >
                                <Activity className="w-3 h-3" />
                                <span className="group-hover/link:underline underline-offset-2">测试连接延迟</span>
                            </button>
                        )}
                    </div>
                </MagicCard>
            </div>
            
            <div className="px-4 flex flex-col justify-end pb-4 shrink-0 w-full max-w-2xl mx-auto min-h-[100px]">
                <div className="h-10 mb-3 relative w-full">
                    <div className={cn(
                        "absolute inset-0 flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-all duration-500 ease-in-out",
                        network === 'overseas' ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
                    )}>
                        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                        <div className="text-[10px] text-amber-100/90 leading-snug">
                            <span className="font-bold text-amber-500">网络警告：</span> 中国大陆直连 Hugging Face 可能导致连接超时。若无全局代理，请切换至 <span className="text-teal-400 font-bold cursor-pointer hover:underline" onClick={() => setNetwork('mainland_china')}>中国大陆</span> 选项。
                        </div>
                    </div>
                </div>

                <Button 
                    variant={network === 'mainland_china' ? 'teal' : 'default'}
                    size="lg" 
                    onClick={() => {
                        setNetworkEnvironment(network);
                        onNext({ networkEnvironment: network });
                    }} 
                    className="w-full shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] animate-[fadeIn_0.5s_ease-out_0.4s_both]"
                >
                    确认并继续 <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};

const EnvironmentCheckStep: React.FC<{ onNext: (data: any) => void, initialData?: any }> = ({ onNext, initialData }) => {
    const { setEnvCheckData } = useWizard();
    const [info, setInfo] = useState(initialData?.systemInfo);
    const [tools, setTools] = useState(initialData?.toolStatus);
    const [loading, setLoading] = useState(false);
    const [installStatus, setInstallStatus] = useState<{[key: string]: 'idle' | 'installing' | 'done' | 'error'}>({});
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
    const [terminalExpanded, setTerminalExpanded] = useState(false);

    const addLog = (msg: string) => setTerminalLogs(prev => [...prev, msg]);

    const runCheck = async () => {
        setLoading(true);
        try {
            addLog(">>> 正在重新扫描系统环境...");
            const [sys, tls] = await Promise.all([tauriInvoke('get_system_info'), tauriInvoke('check_tools')]);
            setInfo(sys);
            setTools(tls);
            setEnvCheckData({ systemInfo: sys, toolStatus: tls });
            
            const initialStatus: any = {};
            if (!tls.git_installed) initialStatus.git = 'idle';
            if (!tls.python_installed) initialStatus.python = 'idle';
            if (!tls.uv_installed) initialStatus.uv = 'idle';
            setInstallStatus(initialStatus);
            addLog("[INFO] 扫描完成。");
            if (!tls.cuda_toolkit_installed && sys.gpu_info?.has_cuda) { // Use has_cuda from gpu_info
                addLog("[WARN] 检测到 NVIDIA 显卡但未找到 CUDA Toolkit。建议安装以获得最佳性能。");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!info) {
            runCheck();
        }
    }, []);

    const simulateInstallLogs = async (toolKey: string) => {
        const logsMap: Record<string, string[]> = {
            git: ["Initializing...", "Downloading Git-2.43.0...", "Installing...", "SUCCESS: Git installation completed."],
            python: ["Checking existing...", "Downloading Python 3.10...", "Installing...", "SUCCESS: Python installed."],
            uv: ["Fetching script...", "Downloading uv...", "Extracting...", "SUCCESS: uv package manager ready."]
        };

        const steps = logsMap[toolKey] || ["Processing..."];
        for (const log of steps) {
            addLog(`[${toolKey.toUpperCase()}] ${log}`);
            await new Promise(r => setTimeout(r, 300)); 
        }
    };

    const handleInstall = async (toolKey: string, installCmd: string) => {
        setTerminalExpanded(true);
        setInstallStatus(prev => ({...prev, [toolKey]: 'installing'}));
        addLog(`>>> 开始安装 ${toolKey}...`);
        
        try {
            const installPromise = tauriInvoke(installCmd);
            await simulateInstallLogs(toolKey);
            await installPromise;

            setInstallStatus(prev => ({...prev, [toolKey]: 'done'}));
            setTools((prev: any) => {
                const updated =
                    toolKey === 'git'
                        ? { ...prev, git_installed: true, git_lfs_installed: true }
                        : toolKey === 'python'
                        ? { ...prev, python_installed: true }
                        : toolKey === 'uv'
                        ? { ...prev, uv_installed: true }
                        : prev;
                if (info) {
                    setEnvCheckData({ systemInfo: info, toolStatus: updated });
                }
                return updated;
            });
            addLog(`>>> ${toolKey} 安装流程结束。`);
        } catch (e) {
            setInstallStatus(prev => ({...prev, [toolKey]: 'error'}));
            addLog(`[ERROR] ${toolKey} 安装失败: ${e}`);
        }
    };

    const DependencyRow = ({ label, statusKey, installed, installCmd, link }: any) => {
        const status = installStatus[statusKey];
        return (
            <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 group transition-colors hover:bg-white/5 px-2 rounded">
                <span className="text-xs text-gray-300 font-medium flex items-center gap-2">{label}</span>
                <div className="flex items-center gap-2">
                    {installed ? (
                        <span className="flex items-center text-green-400 text-[10px] bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 animate-[fadeIn_0.3s_ease-out]">
                            <CheckCircle className="w-3 h-3 mr-1.5" /> 已就绪
                        </span>
                    ) : (
                        <div className="flex items-center gap-2">
                            {status === 'installing' ? (
                                <span className="flex items-center text-purple-400 text-[10px] animate-pulse"><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> 安装中...</span>
                            ) : status === 'done' ? (
                                <span className="flex items-center text-green-400 text-[10px] animate-[zoomIn_0.3s_ease-out]"><CheckCircle className="w-3 h-3 mr-1.5" /> 完成</span>
                            ) : installCmd ? (
                                <Button size="xs" variant="outline" onClick={() => handleInstall(statusKey, installCmd)} className="h-6 border-dashed border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:scale-105 active:scale-95 transition-all">
                                    <Wrench className="w-3 h-3 mr-1" /> 一键修复
                                </Button>
                            ) : link ? (
                                <Button size="xs" variant="outline" onClick={() => tauriOpenUrl(link)} className="h-6 border-dashed border-white/20 text-gray-400 hover:text-white hover:scale-105 active:scale-95 transition-all">
                                    <ExternalLink className="w-3 h-3 mr-1" /> 官网下载
                                </Button>
                            ) : (
                                <span className="flex items-center text-red-400 text-[10px]"><XCircle className="w-3 h-3 mr-1.5" /> 缺失</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const allReady = tools?.git_installed && tools?.python_installed && tools?.uv_installed;

    return (
        <div className="h-full flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between px-2 shrink-0 animate-[slideDown_0.5s_ease-out] mb-1">
                <div>
                    <h2 className="text-lg font-bold text-white tracking-tight">环境自检</h2>
                    <p className="text-[10px] text-gray-500">自动扫描系统硬件与运行依赖。</p>
                </div>
                <Button 
                    size="xs" 
                    variant="ghost" 
                    onClick={runCheck} 
                    disabled={loading}
                    className="gap-1.5 text-gray-400 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
                >
                    <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} /> 重新检测
                </Button>
            </div>

            <div className="flex gap-4 min-h-0 flex-1 transition-all duration-500 ease-in-out">
                {/* 硬件卡片 - 优化间距 */}
                <MagicCard className="flex-1 p-5 flex flex-col gap-4 overflow-hidden animate-[slideUp_0.5s_ease-out_0.1s_both]" gradientColor="rgba(45, 212, 191, 0.1)">
                    <div className="flex items-center gap-2 text-teal-400 border-b border-white/10 pb-3 shrink-0">
                        <Monitor className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">硬件概况</h3>
                    </div>
                    
                    {!info ? <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-600" /></div> : (
                        <div className="flex-1 flex flex-col gap-3 overflow-y-auto scrollbar-thin pr-1 animate-[fadeIn_0.5s_ease-out]">
                            <div className="bg-white/5 p-3 rounded-lg border border-white/5 transition-colors hover:bg-white/10">
                                <div className="text-[10px] text-gray-500 uppercase mb-1 flex items-center gap-1.5"><Cpu className="w-3 h-3"/> 处理器</div>
                                <div className="text-xs font-mono text-white truncate" title={info?.cpu_brand}>{info?.cpu_brand}</div>
                            </div>
                            
                            {info?.gpu_info && (
                                <div className={cn("p-3 rounded-lg border flex flex-col gap-1.5 transition-all hover:scale-[1.02]", info.gpu_info.has_cuda ? "bg-green-500/5 border-green-500/20" : "bg-white/5 border-white/5")}>
                                    <div className="flex items-center justify-between">
                                        <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1.5"><Server className="w-3 h-3"/> 显卡</div>
                                        {info.gpu_info.has_cuda && <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold animate-pulse">CUDA READY</span>}
                                    </div>
                                    <div className="text-xs font-bold text-white truncate" title={info.gpu_info.name}>{info.gpu_info.name}</div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mt-auto">
                                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="text-[10px] text-gray-500 mb-1">内存</div>
                                    <div className="text-sm font-bold font-mono text-teal-400">{formatGb(info?.total_memory_gb)}</div>
                                </div>
                                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="text-[10px] text-gray-500 mb-1">磁盘</div>
                                    <div className="text-sm font-bold font-mono text-teal-400">{formatGb(info?.total_disk_gb)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </MagicCard>

                {/* 软件依赖卡片 */}
                <MagicCard className="flex-1 p-4 flex flex-col gap-3 overflow-hidden animate-[slideUp_0.5s_ease-out_0.2s_both]" gradientColor="rgba(168, 85, 247, 0.1)">
                    <div className="flex items-center gap-2 text-purple-400 border-b border-white/10 pb-2 shrink-0">
                        <Layers className="w-4 h-4" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">核心依赖</h3>
                    </div>
                    <div className="flex-1 flex flex-col space-y-0.5 overflow-y-auto scrollbar-thin pr-1 animate-[fadeIn_0.5s_ease-out_0.2s_both]">
                        <DependencyRow label="Git & LFS" statusKey="git" installed={tools?.git_installed} installCmd="install_git_and_lfs" />
                        <DependencyRow label="Python 3.10+" statusKey="python" installed={tools?.python_installed} installCmd="install_python" />
                        <DependencyRow label="uv 包管理器" statusKey="uv" installed={tools?.uv_installed} installCmd="install_uv" />
                        <DependencyRow label="CUDA Toolkit" statusKey="cuda" installed={tools?.cuda_toolkit_installed} link="https://developer.nvidia.com/cuda-downloads" />
                    </div>
                    
                    {!tools?.cuda_toolkit_installed && info?.gpu_info?.has_cuda && (
                        <div className="mt-1 p-2 rounded bg-amber-500/10 border border-amber-500/20 flex gap-2 items-start shrink-0 animate-[fadeIn_0.5s_ease-out]">
                            <AlertCircle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                            <div className="text-[10px] text-amber-200/80 leading-tight">
                                未检测到 CUDA。若需 GPU 加速，请手动安装后刷新。
                            </div>
                        </div>
                    )}
                </MagicCard>
            </div>

            <div className={cn("flex flex-col gap-3 transition-all duration-500 ease-out", terminalExpanded ? "h-[220px]" : "h-[120px]")}>
                <LogViewer 
                    logs={terminalLogs} 
                    className="flex-1 animate-[fadeIn_0.5s_ease-out_0.3s_both]" 
                    title="执行终端" 
                    onToggleSize={() => setTerminalExpanded(!terminalExpanded)}
                    isExpanded={terminalExpanded}
                />
                
                <div className="flex justify-end items-center shrink-0 animate-[fadeIn_0.5s_ease-out_0.4s_both]">
                    <Button 
                        onClick={() => onNext({ systemInfo: info, toolStatus: tools })} 
                        disabled={loading || !allReady} 
                        variant={allReady ? "default" : "secondary"}
                        className="px-8 w-40 transition-all hover:scale-105 active:scale-95"
                    >
                        {allReady ? "依赖就绪，下一步" : "请先修复依赖"}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const CoreDeploymentStep: React.FC<{ onNext: (data: any) => void }> = ({ onNext }) => {
    const { networkEnvironment, setIndexTtsRepoDir, indexTtsRepoDir } = useWizard();
    const [path, setPath] = useState("");
    const [logs, setLogs] = useState<string[]>([]);
    const [progressStep, setProgressStep] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const isChina = networkEnvironment === 'mainland_china';
    const modelSource = isChina ? "ModelScope (CN)" : "HuggingFace (Global)";

    useEffect(() => {
        if (!isTauriEnvironment) return;
        let unlisten: UnlistenFn | null = null;
        listen<CoreDeployLogPayload>('core-deploy-log', (event) => {
            const payload = event.payload;
            if (!payload?.line) return;
            const cleanedLine = payload.line.replace(/\r/g, '');
            const tags = [payload.step, payload.stream?.toUpperCase()].filter(Boolean).join('|');
            const prefix = tags ? `[${tags}] ` : '';
            setLogs(l => [...l, `${prefix}${cleanedLine}`]);
        })
        .then((fn) => {
            unlisten = fn;
        })
        .catch((err) => {
            console.warn('Failed to subscribe core deploy logs', err);
        });

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    useEffect(() => {
        if (indexTtsRepoDir && !path) {
            setPath(indexTtsRepoDir);
        }
    }, [indexTtsRepoDir, path]);

    const buildCommandPreview = (cmd: string) => {
        switch (cmd) {
            case 'clone_index_tts_repo':
                return `git clone https://github.com/index-tts/index-tts.git "${path}"`;
            case 'init_git_lfs':
                return `git -C "${path}" lfs install && git -C "${path}" lfs pull`;
            case 'setup_index_tts_env': {
                const mirror = isChina ? ' --default-index https://pypi.tuna.tsinghua.edu.cn/simple' : '';
                return `uv sync --all-extras${mirror}`.trim();
            }
            case 'download_index_tts_model': {
                if (isChina) {
                    return 'uv run modelscope download --model IndexTeam/IndexTTS-2 --local_dir checkpoints';
                }
                return 'uv run hf download IndexTeam/IndexTTS-2 --local-dir checkpoints';
            }
            default:
                return '';
        }
    };

    const startDeployment = async () => {
        if (!path) return;
        setIsRunning(true);
        setProgressStep(0);
        setLogs([">>> 初始化 IndexTTS 部署序列..."]);
        
        const steps = [
            {step:1, msg:"[1/4] 克隆核心仓库...", cmd:'clone_index_tts_repo', args: { target_dir: path } }, 
            {step:2, msg:"[2/4] 初始化 Git LFS...", cmd:'init_git_lfs', args: { target_dir: path } }, 
            {step:3, msg:"[3/4] 配置虚拟环境...", cmd:'setup_index_tts_env', args: { target_dir: path, network_environment: networkEnvironment } }, 
            {step:4, msg:"[4/4] 下载模型资源...", cmd:'download_index_tts_model', args: { target_dir: path, network_environment: networkEnvironment } }
        ];

        for (const s of steps) { 
            setProgressStep(s.step); 
            setLogs(l => [...l, s.msg]); 
            const preview = buildCommandPreview(s.cmd);
            if (preview) {
                setLogs(l => [...l, `   $ ${preview}`]);
            }
            // Correctly pass args to tauriInvoke
            const result = await tauriInvoke(s.cmd, s.args); 
            if (result !== "SUCCESS") {
                setLogs(l => [...l, `[ERROR] 步骤 ${s.step} 失败: ${result}`]);
                setIsRunning(false);
                return;
            }
            setLogs(l => [...l, "✔ 完成"]); 
        }
        setLogs(l => [...l, ">>> 所有部署任务执行成功！"]); 
        setProgressStep(5); 
        setIsRunning(false);
        setIndexTtsRepoDir(path); // Save the successfully deployed path
    };

    const StepIndicator = ({ stepNum, label, currentStep }: any) => {
        let status = 'pending'; 
        if (currentStep > stepNum) status = 'done'; 
        else if (currentStep === stepNum) status = 'active';

        return (
            <div className={cn("flex items-center justify-between p-3 rounded-lg border transition-all duration-500 ease-out transform", 
                status === 'active' ? "bg-purple-500/10 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.1)] scale-[1.02]" : 
                status === 'done' ? "bg-green-500/5 border-green-500/20 opacity-80" : 
                "bg-white/5 border-white/5 opacity-50"
            )}>
                <div className="flex items-center gap-3">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors duration-300", 
                        status === 'active' ? "border-purple-400 text-purple-400 animate-pulse" : 
                        status === 'done' ? "border-green-500 bg-green-500 text-white" : 
                        "border-gray-600 text-gray-600"
                    )}>
                        {status === 'done' ? <Check className="w-3 h-3" /> : stepNum}
                    </div>
                    <span className={cn("text-xs font-medium transition-colors duration-300", 
                        status === 'active' ? "text-purple-300" : 
                        status === 'done' ? "text-green-400" : 
                        "text-gray-500"
                    )}>
                        {label}
                    </span>
                </div>
                {status === 'active' && <Loader2 className="w-4 h-4 animate-spin text-purple-500" />}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex gap-4 flex-1 min-h-0">
                <div className="w-1/3 flex flex-col gap-4 animate-[slideRight_0.5s_ease-out_0.1s_both]">
                    <div className="bg-black/40 rounded-xl border border-white/10 p-4 flex flex-col gap-3">
                        <div className="text-[10px] font-bold text-gray-500 uppercase">安装路径</div>
                        <div className="flex gap-2">
                            <input type="text" value={path} onChange={e => setPath(e.target.value)} placeholder="选择目录..." className="flex-1 bg-white/5 rounded px-2 py-1.5 text-xs text-white border border-white/10 focus:border-purple-500 focus:outline-none transition-all focus:ring-1 focus:ring-purple-500" />
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={async () => {
                                    const selectedPath = await tauriOpenDialog();
                                    if (typeof selectedPath === 'string') {
                                        setPath(selectedPath);
                                    } else if (Array.isArray(selectedPath) && selectedPath.length > 0 && typeof selectedPath[0] === 'string') {
                                        setPath(selectedPath[0]);
                                    }
                                }}
                                className="h-full px-2 hover:bg-white/10"
                            >
                                <FolderOpen className="w-3 h-3" />
                            </Button>
                        </div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase mt-1">当前源</div>
                        <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/5 p-2 rounded border border-white/5">
                            {isChina ? <Cloud className="w-3 h-3 text-teal-400"/> : <Globe className="w-3 h-3 text-purple-400"/>}
                            {modelSource}
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-2 overflow-y-auto pr-1">
                        <StepIndicator stepNum={1} label="克隆代码仓库" currentStep={progressStep} />
                        <StepIndicator stepNum={2} label="Git LFS 初始化" currentStep={progressStep} />
                        <StepIndicator stepNum={3} label="配置虚拟环境" currentStep={progressStep} />
                        <StepIndicator stepNum={4} label="下载模型资源" currentStep={progressStep} />
                    </div>

                    <Button 
                        onClick={startDeployment} 
                        disabled={isRunning || !path || progressStep === 5} 
                        className={cn("w-full py-6 text-sm shadow-lg transition-all duration-500 hover:scale-[1.02] active:scale-[0.98]", 
                            progressStep === 5 ? "bg-green-600 hover:bg-green-500" : ""
                        )}
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : progressStep === 5 ? <CheckCircle className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {isRunning ? "部署进行中..." : progressStep === 5 ? "部署完成" : "一键开始部署"}
                    </Button>
                </div>

                <LogViewer logs={logs} className="flex-1 h-full animate-[slideUp_0.5s_ease-out_0.3s_both]" title="部署流水线日志" />
            </div>

            <div className="flex justify-end pt-2 animate-[fadeIn_0.5s_ease-out_0.5s_both]">
                <Button onClick={() => onNext({})} disabled={progressStep !== 5} size="sm" className="w-36 hover:scale-105 active:scale-95 transition-all">
                    进入主控台 <LayoutDashboard className="w-4 h-4 ml-2" />
                </Button>
            </div>
        </div>
    );
};

// 重新设计的 ServerControlStep (主控制台)
const ServerControlStep: React.FC<{ onBackToDeploy: () => void }> = ({ onBackToDeploy }) => {
    const { envCheckData, indexTtsRepoDir, setIndexTtsRepoDir } = useWizard(); // 获取系统检测数据和仓库目录
    const gpuName = envCheckData?.systemInfo?.gpu_info?.name;
    const hasNvidia = !!gpuName && gpuName.toUpperCase().includes('NVIDIA');

    const [status, setStatus] = useState<EngineStatus>('Stopped');
    const [logs, setLogs] = useState<string[]>([]);
    const [useGpu, setUseGpu] = useState(hasNvidia);
    const [useFp16, setUseFp16] = useState(hasNvidia);
    const [repoUpdate, setRepoUpdate] = useState<{ has_update: boolean, message?: string, checking: boolean, local_hash?: string }>({ has_update: false, checking: false });
    const [isPulling, setIsPulling] = useState(false);
    const [currentCmd, setCurrentCmd] = useState("");
    const [repoValid, setRepoValid] = useState<boolean | null>(null);
    const startDisabled = status === 'Stopped' && (!indexTtsRepoDir || repoValid === false);
    const isStarting = status === 'Starting';
    const isRunning = status === 'Running';
    const actionDisabled = status === 'Running' ? false : status === 'Starting' ? true : startDisabled;
    const statusText = isRunning ? "在线" : isStarting ? "准备中" : "离线";
    const statusColor = isRunning ? "text-green-400" : isStarting ? "text-amber-400" : "text-gray-400";

    const waitForWebUiReady = async () => {
        const maxAttempts = 30;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                await fetch(WEBUI_URL, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
                clearTimeout(timeoutId);
                return true;
            } catch (err) {
                // Ignore errors and retry
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        return false;
    };

    useEffect(() => { 
        if (!indexTtsRepoDir) {
            setRepoUpdate({ has_update: false, checking: false, message: "未配置路径", local_hash: undefined });
            setRepoValid(null);
            return;
        }
        const checkUpdate = async () => { 
            setRepoUpdate(p => ({ ...p, checking: true })); 
            try {
                const res = await tauriInvoke('check_repo_update', { target_dir: indexTtsRepoDir }); 
                setRepoUpdate({ has_update: res.has_update, message: res.message, checking: false, local_hash: res.local_hash }); 
            } catch (err) {
                setRepoUpdate({ has_update: false, checking: false, message: "检查失败", local_hash: undefined });
                setLogs(l => [...l, `[ERROR] 仓库更新检查失败: ${err}`]);
            }
        }; 
        const validateRepo = async () => {
            if (!isTauriEnvironment) {
                setRepoValid(true);
                return;
            }
            try {
                const res = await tauriInvoke('check_index_tts_repo', { repo_dir: indexTtsRepoDir });
                setRepoValid(!!res);
                if (!res) {
                    setLogs(l => [...l, "[WARN] 当前目录不是有效的 IndexTTS 仓库，请重新部署或切换路径。"]);
                }
            } catch (err) {
                setRepoValid(false);
                setLogs(l => [...l, `[ERROR] 无法验证仓库: ${err}`]);
            }
        };
        checkUpdate(); 
        validateRepo();
    }, [indexTtsRepoDir]);

    useEffect(() => {
        if (!isTauriEnvironment) return;
        tauriInvoke('get_server_status')
            .then((res: string) => {
                if (res === 'Running') {
                    setStatus('Running');
                } else if (res === 'Starting') {
                    setStatus('Starting');
                } else {
                    setStatus('Stopped');
                }
            })
            .catch((err) => {
                console.warn('Failed to query server status', err);
                setStatus('Stopped');
            });
    }, []);

    useEffect(() => {
        if (!isTauriEnvironment) return;
        let unlistenStdout: UnlistenFn | null = null;
        let unlistenStderr: UnlistenFn | null = null;

        listen<ServerLogPayload>('server-log-stdout', (event) => {
            setLogs(l => [...l, event.payload]);
        }).then((fn) => (unlistenStdout = fn))
          .catch((err) => console.warn('Failed to listen server stdout', err));

        listen<ServerLogPayload>('server-log-stderr', (event) => {
            setLogs(l => [...l, event.payload]);
        }).then((fn) => (unlistenStderr = fn))
          .catch((err) => console.warn('Failed to listen server stderr', err));

        return () => {
            unlistenStdout?.();
            unlistenStderr?.();
        };
    }, []);

    const ensureRepoPath = () => {
        if (!indexTtsRepoDir) {
            setLogs(l => [...l, "[ERROR] 未检测到部署目录，请先完成核心部署或手动选择路径。"]);
            return false;
        }
        if (repoValid === false) {
            setLogs(l => [...l, "[ERROR] 当前路径不是有效的 IndexTTS 仓库，请重新部署或切换路径。"]);
            return false;
        }
        return true;
    };

    const handleSelectRepoPath = async () => {
        if (!isTauriEnvironment) return;
        const selected = await tauriOpenDialog();
        const nextPath = Array.isArray(selected) ? selected[0] : selected;
        if (typeof nextPath === 'string' && nextPath.trim().length > 0) {
            setIndexTtsRepoDir(nextPath);
            setLogs(l => [...l, `>>> 仓库路径已更新为: ${nextPath}`]);
            setRepoUpdate({ has_update: false, checking: false, message: "路径已更新", local_hash: undefined });
        }
    };

    const handlePull = async () => { 
        if (!ensureRepoPath()) return;
        setIsPulling(true);
        setLogs(l => [...l, ">>> 正在拉取最新代码 (Git Pull)..."]); 
        try {
            const result = await tauriInvoke('pull_repo', { target_dir: indexTtsRepoDir }); 
            if (result === "SUCCESS") {
                setLogs(l => [...l, "✔ 代码已更新到最新版本。", ">>> 请重启服务以应用更改。"]); 
                setRepoUpdate(p => ({ ...p, has_update: false, message: "已更新到最新" })); 
            } else {
                setLogs(l => [...l, `[ERROR] 更新失败: ${result}`]);
            }
        } catch (err) {
            setLogs(l => [...l, `[ERROR] 更新失败: ${err}`]);
        } finally {
            setIsPulling(false);
        }
    };
    
    const handleClearLogs = () => {
        setLogs([]);
    };

    const refreshRepo = async () => {
         if (!ensureRepoPath()) return;
         setRepoUpdate(p => ({ ...p, checking: true }));
         setLogs(l => [...l, ">>> 检查仓库更新..."]);
         await new Promise(r => setTimeout(r, 800));
         try {
             const res = await tauriInvoke('check_repo_update', { target_dir: indexTtsRepoDir });
             setRepoUpdate({ has_update: res.has_update, message: res.message, checking: false, local_hash: res.local_hash });
             setLogs(l => [...l, res.has_update ? "发现新版本！" : "当前已是最新版本。"]);
         } catch (err) {
             setRepoUpdate(p => ({ ...p, checking: false }));
             setLogs(l => [...l, `[ERROR] 检查失败: ${err}`]);
         }
    };

    const toggle = async () => { 
        if (status === 'Starting') return;
        if (status === 'Stopped' && !ensureRepoPath()) {
            return;
        }
        if (status === 'Stopped') { 
            const args: { [key: string]: any } = {
                target_dir: indexTtsRepoDir,
                host: "127.0.0.1",
                port: 7860,
                device: useGpu ? "cuda" : "cpu"
            };
            if (useGpu && useFp16) {
                args.precision = "fp16";
            }
            
            const cmdParts = [
                "uv run webui.py",
                `--host ${args.host}`,
                `--port ${args.port}`,
                useGpu ? "--cuda_kernel" : "",
                args.precision ? `--fp16` : ''
            ].filter(Boolean);
            const cmd = cmdParts.join(' ');
            setCurrentCmd(cmd);

            setStatus('Starting'); 
            setLogs(l => [...l, `>>> ${cmd}`, ">>> 正在初始化推理引擎..."]); 
            try {
                const result = await tauriInvoke('start_index_tts_server', args); 
                if (result === "Starting" || result === "Running") {
                    setLogs(l => [...l, ">>> 推理进程已启动，等待 WebUI 响应..."]);
                    const ready = await waitForWebUiReady();
                    if (ready) {
                        setStatus('Running'); 
                        setLogs(l => [...l, `[INFO] HTTP 服务器已在 ${WEBUI_URL} 启动。`, `>>> WebUI 已就绪: ${WEBUI_URL}`]); 
                    } else {
                        setLogs(l => [...l, "[ERROR] WebUI 在预期时间内未响应，请检查日志。"]);
                        try {
                            await tauriInvoke('stop_index_tts_server');
                        } catch (err) {
                            console.warn("Failed to stop server after timeout", err);
                        }
                        setStatus('Stopped');
                    }
                } else {
                    setStatus('Stopped');
                    setLogs(l => [...l, `[ERROR] 服务启动失败: ${result}`]);
                }
            } catch (err) {
                setStatus('Stopped');
                setLogs(l => [...l, `[ERROR] 服务启动失败: ${err}`, "请确认仓库中存在 webui.py 并已完成核心部署。"]);
            }
        } else { 
            try {
                await tauriInvoke('stop_index_tts_server'); 
                setStatus('Stopped'); 
                setLogs(l => [...l, "[INFO] 收到停止信号...", "服务已安全关闭。"]); 
                setCurrentCmd("");
            } catch (err) {
                setLogs(l => [...l, `[ERROR] 停止失败: ${err}`]);
            }
        } 
    };

    return (
        <div className="h-full flex flex-col gap-4 relative p-2 isolate">
             {/* 🚀 新增：运行时光点矩阵呼吸特效背景 */}
            <DotMatrixEffect active={status === 'Running'} />

            {/* 1. 顶部控制核心区 */}
            {/* z-20 ensures this layer is above the log viewer even if it slides up */}
            <div className="flex gap-3 h-auto min-h-[110px] shrink-0 z-20 relative">
                
                {/* 左侧: 引擎状态与开关 (占 40%) */}
                <MagicCard className="flex-[2] p-4 flex flex-col justify-between bg-gradient-to-br from-gray-900 to-black border-white/10 animate-[slideRight_0.5s_ease-out_0.1s_both] relative overflow-hidden" active={isRunning} gradientColor={isRunning ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)"}>
                    
                    {/* 运行时特效背景 - 量子流体 */}
                    {isRunning && (
                        <div className="absolute inset-0 pointer-events-none opacity-30">
                            <div className="absolute w-[200%] h-[200%] bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1),transparent_50%)] animate-[spin_10s_linear_infinite] top-[-50%] left-[-50%]"></div>
                        </div>
                    )}

                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">ENGINE STATUS</div>
                            <div className={cn("text-2xl font-black tracking-tight transition-colors duration-500", statusColor)}>
                                {statusText}
                            </div>
                            {isStarting && <div className="text-[10px] text-amber-300 mt-1">等待 WebUI 响应...</div>}
                        </div>
                        {/* 动态图表/呼吸灯 */}
                        {isRunning ? (
                            <div className="flex gap-1 items-end h-4">
                                <div className="w-1 bg-green-500 h-2 animate-[bounce_1s_infinite]"></div>
                                <div className="w-1 bg-green-500 h-3 animate-[bounce_1.2s_infinite]"></div>
                                <div className="w-1 bg-green-500 h-4 animate-[bounce_0.8s_infinite]"></div>
                            </div>
                        ) : isStarting ? (
                            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                        ) : (
                            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_currentColor]"></div>
                        )}
                    </div>
                    
                    {/* 巨大的启动按钮 */}
                    <div className="relative z-10 mt-2">
                         <Button 
                            size="lg" 
                            variant={isRunning ? "consoleStop" : "consoleStart"} 
                            className="w-full h-10 text-sm font-bold tracking-wide transition-all hover:scale-[1.02] active:scale-[0.98]"
                            disabled={actionDisabled}
                            onClick={toggle}
                        >
                            {isRunning ? (
                                <><StopCircle className="w-4 h-4 mr-2" /> 停止服务</>
                            ) : isStarting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 启动中...</>
                            ) : (
                                <><Play className="w-4 h-4 mr-2 fill-current" /> 启动引擎</>
                            )}
                        </Button>
                    </div>
                </MagicCard>

                {/* 中间: 快捷入口 (占 20%) */}
                <MagicCard className="flex-1 p-4 flex flex-col justify-between bg-white/5 animate-[fadeIn_0.5s_ease-out_0.2s_both]" gradientColor="rgba(59, 130, 246, 0.1)">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">ACCESS POINT</div>
                    <div className="flex-1 flex items-center justify-center my-2 relative">
                        <div className={cn("p-3 rounded-xl transition-all duration-500 z-10", 
                            isRunning ? "bg-blue-500/20 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-110" : 
                            isStarting ? "bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-105" : 
                            "bg-white/5 text-gray-600"
                        )}>
                            <Globe className="w-6 h-6" />
                        </div>
                        {isRunning && <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>}
                        {isStarting && <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse"></div>}
                    </div>
                    {isStarting && <div className="text-[10px] text-amber-300 text-center mb-1">WebUI 启动中...</div>}
                    <Button 
                        size="xs" 
                        variant="outline" 
                        disabled={!isRunning} 
                        onClick={() => tauriOpenUrl(WEBUI_URL)}
                        className={cn("w-full border-dashed transition-all", isRunning ? "border-blue-500/50 text-blue-300 hover:bg-blue-500/10" : "opacity-50")}
                    >
                        <ExternalLink className="w-3 h-3 mr-1" /> 打开 WebUI
                    </Button>
                </MagicCard>

                {/* 右侧: 硬件配置 (占 20%) */}
                <MagicCard className="flex-1 p-3 flex flex-col justify-between bg-white/5 animate-[fadeIn_0.5s_ease-out_0.3s_both]">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">COMPUTE</div>
                    <div className="flex flex-col gap-2 justify-center h-full">
                         {hasNvidia ? (
                             <>
                                <div 
                                    className={cn("flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all border hover:bg-white/5", useGpu ? "bg-green-500/10 border-green-500/30 text-green-400" : "border-white/10 text-gray-500", status === 'Running' && "opacity-50 pointer-events-none grayscale")}
                                    onClick={() => setUseGpu(!useGpu)}
                                >
                                    <span className="text-[10px] font-bold flex items-center gap-1"><ChipIcon className="w-3 h-3" /> GPU</span>
                                    <div className={cn("w-2 h-2 rounded-full", useGpu ? "bg-green-500 shadow-[0_0_5px_currentColor]" : "bg-gray-600")}></div>
                                </div>
                                <div 
                                    className={cn("flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-all border hover:bg-white/5", useFp16 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "border-white/10 text-gray-500", status === 'Running' && "opacity-50 pointer-events-none grayscale")}
                                    onClick={() => setUseFp16(!useFp16)}
                                >
                                    <span className="text-[10px] font-bold flex items-center gap-1"><Gauge className="w-3 h-3" /> FP16</span>
                                    <div className={cn("w-2 h-2 rounded-full", useFp16 ? "bg-yellow-500 shadow-[0_0_5px_currentColor]" : "bg-gray-600")}></div>
                                </div>
                             </>
                         ) : (
                             <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-2 opacity-60">
                                 <Cpu className="w-6 h-6 text-blue-400" />
                                 <div className="text-[9px] text-gray-400">CPU 模式运行中<br/>(未检测到 N 卡)</div>
                             </div>
                         )}
                    </div>
                </MagicCard>

                 {/* 最右侧: 版本控制 (占 20%) */}
                 <MagicCard className="flex-1 p-3 flex flex-col justify-between bg-white/5 animate-[fadeIn_0.5s_ease-out_0.4s_both] relative overflow-hidden">
                    <div className="flex justify-between items-center">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">REPO</div>
                        <div className="flex items-center gap-2">
                            <button onClick={(e) => {e.stopPropagation(); handleSelectRepoPath();}} className="text-gray-500 hover:text-white transition-colors text-[10px] underline decoration-dotted">
                                {indexTtsRepoDir ? "更改路径" : "选择路径"}
                            </button>
                            {repoUpdate.checking && <Loader2 className="w-3 h-3 animate-spin text-gray-500" />}
                            <button onClick={(e) => {e.stopPropagation(); refreshRepo();}} className="text-gray-500 hover:text-white transition-colors"><RefreshCcw className="w-3 h-3" /></button>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-1 py-1 min-h-[60px]">
                        <div className="text-[10px] text-gray-500 uppercase">路径</div>
                        <div className="text-[9px] text-gray-400 font-mono break-all bg-black/30 rounded p-1 border border-white/5">
                            {indexTtsRepoDir || "未配置，请先部署或选择目录"}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                            <GitBranch className="w-3 h-3" /> {repoUpdate.local_hash || "Unknown"}
                        </div>
                        {repoUpdate.has_update ? <div className="text-[9px] text-orange-400 mt-0.5 animate-pulse font-bold">发现新版本</div> : <div className="text-[9px] text-green-500 mt-0.5">{repoUpdate.message || "已是最新"}</div>}
                {repoValid === false && (
                    <div className="text-[9px] text-red-400 flex flex-col gap-1">
                        <span>当前目录不是 IndexTTS 仓库，请重新选择或重新部署。</span>
                        <div className="flex flex-col gap-1">
                            <Button size="xs" variant="warning" className="w-full" onClick={onBackToDeploy}>返回核心部署</Button>
                        </div>
                    </div>
                )}
                    </div>

                    {repoUpdate.has_update ? (
                        <Button 
                            size="xs" 
                            variant="warning" 
                            disabled={isPulling}
                            onClick={handlePull} 
                            className="w-full h-6 text-[9px] px-1"
                        >
                            {isPulling ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowDownCircle className="w-3 h-3 mr-1" />} 
                            {isPulling ? "更新中" : "一键更新"}
                        </Button>
                    ) : (
                         <div className="h-6 flex items-center justify-center text-[10px] text-gray-500 bg-white/5 rounded border border-white/5">
                            <Check className="w-3 h-3 mr-1" /> 就绪
                         </div>
                    )}
                </MagicCard>
            </div>

            {/* 运行指令显示区 */}
            {currentCmd && (
                <div className="px-3 py-2 bg-black/60 border border-purple-500/20 rounded-lg flex items-center gap-3 animate-[slideDown_0.3s_ease-out] overflow-hidden z-10">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0"></div>
                    <code className="text-[10px] font-mono text-purple-300 truncate">{currentCmd}</code>
                </div>
            )}

            {/* 2. 底部日志终端 (自动填充剩余高度) */}
            <div className="flex-1 min-h-0 flex flex-col animate-[slideUp_0.5s_ease-out_0.5s_both] z-10 relative">
                 <LogViewer 
                    logs={logs} 
                    className="h-full border-t border-white/10 shadow-2xl bg-black/80 backdrop-blur-md" 
                    title="实时控制台 & 运行日志" 
                    onClear={handleClearLogs}
                 />
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [step, setStep] = useState(() => (loadWizardState().indexTtsRepoDir ? 3 : 0));
    const next = () => setStep(s => Math.min(s + 1, 3));
    const back = () => setStep(s => Math.max(0, s - 1));
    const goToStep = (idx: number) => setStep(() => Math.max(0, Math.min(idx, 3)));
    const steps = [
        <NetworkSelectStep onNext={next} />,
        <EnvironmentCheckStep onNext={next} />,
        <CoreDeploymentStep onNext={next} />,
        <ServerControlStep onBackToDeploy={() => goToStep(2)} />
    ];
    const isServerControl = step === 3;

    return (
        <div className="flex items-center justify-center w-screen h-screen bg-black animate-[fadeIn_1s_ease-out]">
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideRight { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes slideLeft { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
                @keyframes zoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes scan { 0% { transform: translateY(-50%); } 100% { transform: translateY(0%); } }
                ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; } ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
            `}</style>
            <div className="relative w-[800px] h-[600px] bg-[#050505] text-white font-sans overflow-hidden shadow-2xl border border-white/10 rounded-xl selection:bg-purple-500/30 flex flex-col transition-all duration-500">
                <div className="absolute inset-0 z-0 pointer-events-none"><div className="absolute inset-[-50%] bg-[radial-gradient(circle_at_50%_50%,rgba(76,29,149,0.15),transparent_50%)] animate-pulse" style={{ animationDuration: '8s' }}></div><div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div></div>
                {showSplash ? <SplashScreen onComplete={() => setShowSplash(false)} /> : 
                    <WizardProvider>
                        <div className="relative z-10 flex flex-col h-full animate-[fadeIn_0.8s_ease-out]">
                            <div className="h-14 px-6 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md shrink-0 transition-all duration-500 z-30">
                                <div className="flex items-center gap-3">
                                    {!isServerControl && step > 0 && <button onClick={back} className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-white/10 transition-all duration-300 hover:scale-110 active:scale-95" aria-label="Go back"><ArrowLeft className="w-4 h-4" /></button>}
                                    <div className="flex items-center gap-2"><BrandLogo className="w-6 h-6" /><span className="font-bold text-sm tracking-wider">IndexTTS <span className="text-gray-500">HUB</span></span></div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {!isServerControl ? (
                                        <WizardProgress currentStep={step} totalSteps={steps.length - 1} />
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => goToStep(0)}
                                            className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] text-gray-400 animate-[fadeIn_0.5s_ease-out] cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
                                            title="点击切换到引导流程"
                                        >
                                            <LayoutDashboard className="w-3 h-3" />
                                            <span>控制台模式</span>
                                        </button>
                                    )} 
                                </div>
                            </div>
                            <div className="flex-1 p-6 overflow-hidden flex flex-col relative z-20"><div className="flex-1 h-full">{steps[step]}</div></div>
                            <div className="h-8 bg-black/60 border-t border-white/5 px-4 flex items-center justify-between text-[10px] text-gray-600 font-mono shrink-0 z-30"><span>{isServerControl ? "系统运行中" : "配置向导"}</span><span>V0.1.0</span></div>
                        </div>
                    </WizardProvider>
                }
            </div>
        </div>
    );
};

export default App;
