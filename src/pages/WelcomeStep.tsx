import React, { useState } from 'react';

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

    const handleNext = () => {
        onNext({ networkEnvironment, hasDedicatedGpu });
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">Welcome to IndexTTS One-Click Launcher!</h2>
            <p>This tool will help you set up the environment for IndexTTS2.</p>
            <p><strong>Please note:</strong></p>
            <ul className="list-disc list-inside ml-4">
                <li>This tool will execute system commands to install Git, uv, and IndexTTS dependencies.</li>
                <li>For users in Mainland China, this tool will utilize mirrors like <code>hf-mirror.com</code> to improve network access to HuggingFace.</li>
            </ul>

            <div className="form-control">
                <label className="label">
                    <span className="label-text">Your Network Environment:</span>
                </label>
                <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="networkEnvironment"
                            value="overseas"
                            checked={networkEnvironment === 'overseas'}
                            onChange={() => setNetworkEnvironment('overseas')}
                            className="radio radio-primary"
                        />
                        <span className="ml-2">Overseas</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="networkEnvironment"
                            value="mainland_china"
                            checked={networkEnvironment === 'mainland_china'}
                            onChange={() => setNetworkEnvironment('mainland_china')}
                            className="radio radio-primary"
                        />
                        <span className="ml-2">Mainland China</span>
                    </label>
                </div>
            </div>

            <div className="form-control">
                <label className="label">
                    <span className="label-text">Do you have a dedicated GPU?</span>
                </label>
                <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="hasDedicatedGpu"
                            value="yes"
                            checked={hasDedicatedGpu === 'yes'}
                            onChange={() => setHasDedicatedGpu('yes')}
                            className="radio radio-primary"
                        />
                        <span className="ml-2">Yes</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="hasDedicatedGpu"
                            value="no"
                            checked={hasDedicatedGpu === 'no'}
                            onChange={() => setHasDedicatedGpu('no')}
                            className="radio radio-primary"
                        />
                        <span className="ml-2">No</span>
                    </label>
                    <label className="inline-flex items-center">
                        <input
                            type="radio"
                            name="hasDedicatedGpu"
                            value="unsure"
                            checked={hasDedicatedGpu === 'unsure'}
                            onChange={() => setHasDedicatedGpu('unsure')}
                            className="radio radio-primary"
                        />
                        <span className="ml-2">Unsure</span>
                    </label>
            </div>
            </div>


            <div className="mt-6">
                <button className="btn btn-primary" onClick={handleNext}>
                    Continue
                </button>
            </div>
        </div>
    );
};

export default WelcomeStep;
