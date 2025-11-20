import CipherRevealText from "../components/CipherRevealText";
import React, { useState } from 'react';
import MagicCard from '../components/MagicCard';
import { Button } from '../components/ui/button';
import { Globe, Cloud, Cpu, Server, HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface WelcomeStepProps {
    onNext: (data: WelcomeStepData) => void;
    initialData?: WelcomeStepData;
}

export interface WelcomeStepData {
    networkEnvironment: 'overseas' | 'mainland_china';
    hasDedicatedGpu: 'yes' | 'no' | 'unsure';
}

const networkOptions = [
    { value: 'overseas', label: 'Overseas', icon: <Globe className="w-8 h-8 mb-2" /> },
    { value: 'mainland_china', label: 'Mainland China', icon: <Cloud className="w-8 h-8 mb-2" /> },
];

const gpuOptions = [
    { value: 'yes', label: 'Yes', icon: <Server className="w-8 h-8 mb-2" /> },
    { value: 'no', label: 'No', icon: <Cpu className="w-8 h-8 mb-2" /> },
    { value: 'unsure', label: 'Unsure', icon: <HelpCircle className="w-8 h-8 mb-2" /> },
];

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext, initialData }) => {
    const [networkEnvironment, setNetworkEnvironment] = useState<WelcomeStepData['networkEnvironment']>(
        initialData?.networkEnvironment || 'mainland_china'
    );
    const [hasDedicatedGpu, setHasDedicatedGpu] = useState<WelcomeStepData['hasDedicatedGpu']>(
        initialData?.hasDedicatedGpu || 'unsure'
    );

    const handleNext = () => {
        onNext({ networkEnvironment, hasDedicatedGpu });
    };

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1.5">
                <CipherRevealText text="IndexTTS Setup" className="text-2xl font-semibold text-primary" interval={80} />
                <p className="text-xs text-foreground/60">先告诉我们网络与 GPU 情况。</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <section className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3 text-center">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/70">网络</h3>
                    <div className="grid gap-2">
                        {networkOptions.map((option) => (
                            <MagicCard
                                key={option.value}
                                className={cn(
                                    'h-24 cursor-pointer transition-all',
                                    networkEnvironment === option.value ? 'border-primary shadow-primary/20 shadow-lg' : 'border-border',
                                )}
                                onClick={() => setNetworkEnvironment(option.value as WelcomeStepData['networkEnvironment'])}
                            >
                                <div className="flex flex-col items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-sm font-medium">{option.label}</span>
                                </div>
                            </MagicCard>
                        ))}
                    </div>
                </section>

                <section className="space-y-2 rounded-xl border border-border/60 bg-background/60 p-3 text-center">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/70">GPU</h3>
                    <div className="grid gap-2">
                        {gpuOptions.map((option) => (
                            <MagicCard
                                key={option.value}
                                className={cn(
                                    'h-24 cursor-pointer transition-all',
                                    hasDedicatedGpu === option.value ? 'border-primary shadow-primary/20 shadow-lg' : 'border-border',
                                )}
                                onClick={() => setHasDedicatedGpu(option.value as WelcomeStepData['hasDedicatedGpu'])}
                            >
                                <div className="flex flex-col items-center justify-center gap-1">
                                    {option.icon}
                                    <span className="text-sm font-medium">{option.label}</span>
                                </div>
                            </MagicCard>
                        ))}
                    </div>
                </section>
            </div>

            <div className="flex justify-center pt-2">
                <Button size="sm" onClick={handleNext} className="px-6">
                    下一步
                </Button>
            </div>
        </div>
    );
};

export default WelcomeStep;
