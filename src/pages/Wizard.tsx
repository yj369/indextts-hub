import React, { useEffect, useMemo, useState } from 'react';
import { useWizard } from '../context/WizardContext';
import WelcomeStep, { WelcomeStepData } from './WelcomeStep';
import EnvCheckStep, { EnvCheckStepData } from './EnvCheckStep';
import InstallToolsStep, { InstallToolsStepData } from './InstallToolsStep';
import IndexTTSSetupStep, { IndexTTSSetupStepData } from './IndexTTSSetupStep';
import ModelDownloadStep, { ModelDownloadStepData } from './ModelDownloadStep';
import GpuConfigStep, { GpuConfigStepData } from './GpuConfigStep';
import ServerControlStep, { ServerControlStepData } from './ServerControlStep';
import { Button } from '../components/ui/button';
import WizardProgress from '../components/layout/WizardProgress';
import MagicCard from '../components/MagicCard';
import { ArrowLeft, Settings } from 'lucide-react';

const CURRENT_STEP_STORAGE_KEY = 'indextts-hub:wizard-current-step';

const getStoredStep = () => {
    if (typeof window === 'undefined') return 0;
    const raw = window.localStorage.getItem(CURRENT_STEP_STORAGE_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
};

const Wizard: React.FC = () => {
    const {
        networkEnvironment,
        setNetworkEnvironment,
        hasDedicatedGpu,
        setHasDedicatedGpu,
        envCheckData,
        setEnvCheckData,
        installToolsData,
        setInstallToolsData,
        indexTtsSetupData,
        setIndexTtsSetupData,
        modelDownloadData,
        setModelDownloadData,
        gpuConfigData,
        setGpuConfigData,
        serverControlData,
        setServerControlData,
    } = useWizard();

    const [currentStep, setCurrentStep] = useState<number>(() => getStoredStep());

    const isMacOS = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
    const shouldShowGpuStep = hasDedicatedGpu === 'yes' && !isMacOS;

    useEffect(() => {
        window.localStorage.setItem(CURRENT_STEP_STORAGE_KEY, currentStep.toString());
    }, [currentStep]);

    // Handlers for next steps (same logic as before, just mapping data)
    const handleWelcomeStepNext = (data: WelcomeStepData) => {
        setNetworkEnvironment(data.networkEnvironment);
        setHasDedicatedGpu(data.hasDedicatedGpu);
        goToNextStep();
    };
    const handleEnvCheckStepNext = (data: EnvCheckStepData) => { setEnvCheckData(data); goToNextStep(); };
    const handleInstallToolsStepNext = (data: InstallToolsStepData) => { setInstallToolsData(data); goToNextStep(); };
    const handleIndexTTSSetupStepNext = (data: IndexTTSSetupStepData) => { setIndexTtsSetupData(data); goToNextStep(); };
    const handleModelDownloadStepNext = (data: ModelDownloadStepData) => { setModelDownloadData(data); goToNextStep(); };
    const handleGpuConfigStepNext = (data: GpuConfigStepData) => { setGpuConfigData(data); goToNextStep(); };
    const handleServerControlStepNext = (data: ServerControlStepData) => { setServerControlData(data); console.log('Complete', data); };

    const setupSteps = [
        { name: 'Initialization', component: <WelcomeStep onNext={handleWelcomeStepNext} initialData={{ networkEnvironment, hasDedicatedGpu }} /> },
        { name: 'System Scan', component: <EnvCheckStep onNext={handleEnvCheckStepNext} initialData={envCheckData || undefined} /> },
        { name: 'Dependencies', component: <InstallToolsStep onNext={handleInstallToolsStepNext} initialData={installToolsData || undefined} /> },
        { name: 'Core Setup', component: <IndexTTSSetupStep onNext={handleIndexTTSSetupStepNext} initialData={indexTtsSetupData || undefined} /> },
        { name: 'Assets', component: <ModelDownloadStep onNext={handleModelDownloadStepNext} initialData={modelDownloadData || undefined} /> },
        ...(shouldShowGpuStep ? [{ name: 'Hardware', component: <GpuConfigStep onNext={handleGpuConfigStepNext} initialData={gpuConfigData || undefined} /> }] : []),
    ];

    const serverControlStep = {
        name: 'Control Panel',
        component: <ServerControlStep onNext={handleServerControlStepNext} initialData={serverControlData || undefined} />,
    };

    const allSetupComplete = useMemo(() => {
        return Boolean(envCheckData && installToolsData?.gitInstalled && indexTtsSetupData?.repoCloned && modelDownloadData?.modelDownloaded);
    }, [envCheckData, installToolsData, indexTtsSetupData, modelDownloadData]);

    useEffect(() => {
        if (allSetupComplete && currentStep < setupSteps.length) {
            // Optional: Auto skip to server control if everything is done, but usually user wants to see config
        }
    }, [allSetupComplete]);

    const goToNextStep = () => { if (currentStep < setupSteps.length) setCurrentStep(currentStep + 1); };
    const goToPreviousStep = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };

    const activeComponent = currentStep >= setupSteps.length ? serverControlStep.component : setupSteps[currentStep].component;
    const isServerControl = currentStep >= setupSteps.length;

    return (
        <div className="w-full">
            {!isServerControl && (
                <WizardProgress currentStep={currentStep} totalSteps={setupSteps.length} />
            )}

            <MagicCard className="p-1 bg-black/40 backdrop-blur-md border-white/10">
                <div className="relative p-6 rounded-xl bg-black/40 overflow-hidden min-h-[500px]">
                    {/* Decorative Top Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                    <div className="flex justify-between items-center mb-6">
                        {currentStep > 0 && !isServerControl ? (
                            <Button variant="ghost" size="sm" onClick={goToPreviousStep} className="text-gray-400 hover:text-white">
                                <ArrowLeft className="w-4 h-4 mr-2" /> BACK
                            </Button>
                        ) : <div></div>}

                        {allSetupComplete && !isServerControl && (
                            <Button variant="outline" size="sm" onClick={() => setCurrentStep(setupSteps.length)} className="text-xs">
                                SKIP TO DASHBOARD
                            </Button>
                        )}
                        {isServerControl && (
                            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(0)} className="text-gray-400 hover:text-white">
                                <Settings className="w-4 h-4 mr-2" /> RE-CONFIGURE
                            </Button>
                        )}
                    </div>

                    <div className="animate-fade-in">
                        {activeComponent}
                    </div>
                </div>
            </MagicCard>
        </div>
    );
};

export default Wizard;
