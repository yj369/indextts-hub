import React from 'react';
import { cn } from '../../lib/utils';

interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
}

const WizardProgress: React.FC<WizardProgressProps> = ({ currentStep, totalSteps }) => {
  return (
    <div className="flex justify-center gap-2 mb-8">
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "w-3 h-3 rounded-full transition-all duration-300",
            index === currentStep ? "bg-primary" : "bg-gray-700 hover:bg-gray-600"
          )}
        />
      ))}
    </div>
  );
};

export default WizardProgress;
