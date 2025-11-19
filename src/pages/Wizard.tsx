import React, { useEffect, useState } from 'react';
import { useWizard } from '../context/WizardContext';
import WelcomeStep, { WelcomeStepData } from './WelcomeStep';
import EnvCheckStep, { EnvCheckStepData } from './EnvCheckStep';
import InstallToolsStep, { InstallToolsStepData } from './InstallToolsStep';
import IndexTTSSetupStep, { IndexTTSSetupStepData } from './IndexTTSSetupStep';
import ModelDownloadStep, { ModelDownloadStepData } from './ModelDownloadStep';
import GpuConfigStep, { GpuConfigStepData } from './GpuConfigStep';
import ServerControlStep, { ServerControlStepData } from './ServerControlStep';

const Wizard: React.FC = () => {
    const {
        networkEnvironment, setNetworkEnvironment,
        hasDedicatedGpu, setHasDedicatedGpu,
        envCheckData, setEnvCheckData,
        installToolsData, setInstallToolsData,
        indexTtsSetupData, setIndexTtsSetupData,
        modelDownloadData, setModelDownloadData,
        gpuConfigData, setGpuConfigData,
        serverControlData, setServerControlData
    } = useWizard();
    const [currentStep, setCurrentStep] = useState(0);

    const isMacOS = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
    const shouldShowGpuStep = hasDedicatedGpu === 'yes' && !isMacOS;

    const handleWelcomeStepNext = (data: WelcomeStepData) => {
        setNetworkEnvironment(data.networkEnvironment);
        setHasDedicatedGpu(data.hasDedicatedGpu);
        goToNextStep();
    };

    const handleEnvCheckStepNext = (data: EnvCheckStepData) => {
        setEnvCheckData(data);
        goToNextStep();
    };

    const handleInstallToolsStepNext = (data: InstallToolsStepData) => {
        setInstallToolsData(data);
        goToNextStep();
    };

    const handleIndexTTSSetupStepNext = (data: IndexTTSSetupStepData) => {
        setIndexTtsSetupData(data);
        goToNextStep();
    };

    const handleModelDownloadStepNext = (data: ModelDownloadStepData) => {
        setModelDownloadData(data);
        goToNextStep();
    };

    const handleGpuConfigStepNext = (data: GpuConfigStepData) => {
        setGpuConfigData(data);
        goToNextStep();
    };

    const handleServerControlStepNext = (data: ServerControlStepData) => {
        setServerControlData(data);
        // This is the last step, so we might want to do something else here, or just finish.
        // For now, it just means the step is completed.
        console.log("Wizard completed!", data);
    };


    const steps = [
        {
            name: "Welcome",
            component: (
                <WelcomeStep
                    onNext={handleWelcomeStepNext}
                    initialData={{ networkEnvironment, hasDedicatedGpu }}
                />
            )
        },
        {
            name: "Environment Check",
            component: (
                <EnvCheckStep
                    onNext={handleEnvCheckStepNext}
                    initialData={envCheckData || undefined}
                />
            )
        },
        {
            name: "Install Tools",
            component: (
                <InstallToolsStep
                    onNext={handleInstallToolsStepNext}
                    initialData={installToolsData || undefined}
                />
            )
        },
        {
            name: "IndexTTS Setup",
            component: (
                <IndexTTSSetupStep
                    onNext={handleIndexTTSSetupStepNext}
                    initialData={indexTtsSetupData || undefined}
                />
            )
        },
        {
            name: "Model Download",
            component: (
                <ModelDownloadStep
                    onNext={handleModelDownloadStepNext}
                    initialData={modelDownloadData || undefined}
                />
            )
        },
        ...(shouldShowGpuStep
            ? [
                  {
                      name: "GPU Configuration",
                      component: (
                          <GpuConfigStep
                              onNext={handleGpuConfigStepNext}
                              initialData={gpuConfigData || undefined}
                          />
                      ),
                  },
              ]
            : []),
        {
            name: "Server Control",
            component: (
                <ServerControlStep
                    onNext={handleServerControlStepNext}
                    initialData={serverControlData || undefined}
                />
            )
        },
    ];

    useEffect(() => {
        if (currentStep >= steps.length) {
            setCurrentStep(Math.max(steps.length - 1, 0));
        }
    }, [currentStep, steps.length]);

    const goToNextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const goToPreviousStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold mb-4">IndexTTS One-Click Launcher - {steps[currentStep]?.name || `Step ${currentStep}`}</h1>

            <div className="wizard-content">
                {steps[currentStep]?.component || <p>Step {currentStep} not implemented yet.</p>}
            </div>

            <div className="flex justify-between mt-4">
                <button
                    className="btn"
                    onClick={goToPreviousStep}
                    disabled={currentStep === 0}
                >
                    Back
                </button>
                <button
                    className="btn btn-primary"
                    onClick={goToNextStep}
                    disabled={currentStep === steps.length - 1} // Only disable if it's the very last step.
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default Wizard;
