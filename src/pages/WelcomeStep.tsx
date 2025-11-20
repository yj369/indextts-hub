import React, { useState } from 'react';
import MagicCard from '../components/MagicCard';
import { Button } from '../components/ui/button';
import { Globe, Cloud, Cpu, Server, HelpCircle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

interface WelcomeStepProps {
    onNext: (data: WelcomeStepData) => void;
    initialData?: WelcomeStepData;
}

export interface WelcomeStepData {
    networkEnvironment: 'overseas' | 'mainland_china';
    hasDedicatedGpu: 'yes' | 'no' | 'unsure';
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext, initialData }) => {
    const [networkEnvironment, setNetworkEnvironment] = useState<WelcomeStepData['networkEnvironment']>(
        initialData?.networkEnvironment || 'mainland_china'
    );
    const [hasDedicatedGpu, setHasDedicatedGpu] = useState<WelcomeStepData['hasDedicatedGpu']>(
        initialData?.hasDedicatedGpu || 'unsure'
    );
    const hardwareOptions: Array<{
        value: WelcomeStepData['hasDedicatedGpu'];
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
    }> = [
        { value: 'yes', label: 'NVIDIA GPU', icon: Server, color: 'text-green-500' },
        { value: 'no', label: 'CPU Only', icon: Cpu, color: 'text-blue-500' },
        { value: 'unsure', label: 'Unsure', icon: HelpCircle, color: 'text-yellow-500' }
    ];

    const handleNext = () => {
        onNext({ networkEnvironment, hasDedicatedGpu });
    };

    return (
        <div className="space-y-8 py-4">
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono uppercase tracking-widest">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    System Initialization
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                    Index<span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">TTS</span> Hub
                </h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    配置您的本地语音合成环境。请提供基础信息以优化安装流程。
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Network Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest ml-1">Network / 网络环境</h3>
                    <div className="grid grid-cols-1 gap-3">
                        <MagicCard
                            className={cn(
                                "cursor-pointer p-4 flex items-center gap-4 transition-all",
                                networkEnvironment === 'overseas' ? "border-primary bg-primary/5" : "opacity-60 hover:opacity-100"
                            )}
                            onClick={() => setNetworkEnvironment('overseas')}
                        >
                            <div className={cn("p-3 rounded-lg bg-white/5", networkEnvironment === 'overseas' && "text-primary bg-primary/10")}>
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold">Global / 海外</div>
                                <div className="text-xs text-gray-500">HuggingFace, GitHub Direct</div>
                            </div>
                        </MagicCard>

                        <MagicCard
                            className={cn(
                                "cursor-pointer p-4 flex items-center gap-4 transition-all",
                                networkEnvironment === 'mainland_china' ? "border-secondary bg-secondary/5" : "opacity-60 hover:opacity-100"
                            )}
                            onClick={() => setNetworkEnvironment('mainland_china')}
                            gradientColor="rgba(45, 212, 191, 0.15)"
                        >
                            <div className={cn("p-3 rounded-lg bg-white/5", networkEnvironment === 'mainland_china' && "text-secondary bg-secondary/10")}>
                                <Cloud className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="font-bold">CN / 中国大陆</div>
                                <div className="text-xs text-gray-500">镜像加速, ModelScope</div>
                            </div>
                        </MagicCard>
                    </div>
                </div>

                {/* GPU Section */}
                <div className="space-y-3">
                    <h3 className="text-xs font-mono text-gray-500 uppercase tracking-widest ml-1">Hardware / 硬件加速</h3>
                    <div className="grid grid-cols-3 gap-3 h-full">
                        {hardwareOptions.map((opt) => {
                            const Icon = opt.icon;
                            return (
                            <MagicCard
                                key={opt.value}
                                className={cn(
                                    "cursor-pointer flex flex-col items-center justify-center gap-2 p-2 transition-all h-full text-center",
                                    hasDedicatedGpu === opt.value ? "border-white/40 bg-white/5 shadow-lg" : "opacity-50 hover:opacity-100"
                                )}
                                onClick={() => setHasDedicatedGpu(opt.value)}
                            >
                                <div className={cn("p-2 rounded-full bg-black/40", hasDedicatedGpu === opt.value && opt.color)}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold">{opt.label}</span>
                            </MagicCard>
                        );})}
                    </div>
                </div>
            </div>

            <div className="flex justify-center pt-6">
                <Button size="lg" onClick={handleNext} className="group min-w-[200px]">
                    初始化系统 <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
            </div>
        </div>
    );
};

export default WelcomeStep;
