import React from 'react';

interface WizardProgressProps {
    currentStep: number;
    totalSteps: number;
}

const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep, totalSteps }) => {
    // Calculate percentage for the glowing bar
    const progressPercentage = ((currentStep + 1) / totalSteps) * 100;

    return (
        <div className="w-full max-w-md mx-auto mb-8">
            <div className="flex justify-between items-end mb-2 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <span>Sequence {currentStep + 1}/{totalSteps}</span>
                <span>{Math.round(progressPercentage)}% Complete</span>
            </div>

            <div className="relative h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                {/* Background Grid */}
                <div className="absolute inset-0 w-full h-full opacity-20 bg-[linear-gradient(90deg,transparent_20%,#000_20%)] bg-[length:4px_100%]" />

                {/* Active Bar */}
                <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                    style={{ width: `${progressPercentage}%` }}
                >
                    {/* Shimmer effect on bar */}
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                </div>
            </div>
        </div>
    );
};

export default WizardProgress;
