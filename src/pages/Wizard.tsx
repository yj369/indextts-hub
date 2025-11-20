import React, { useEffect, useMemo, useState } from 'react';
import { useWizard } from '../context/WizardContext';
import WelcomeStep, { WelcomeStepData } from './WelcomeStep';
import EnvCheckStep, { EnvCheckStepData } from './EnvCheckStep';
import InstallToolsStep, { InstallToolsStepData } from './InstallToolsStep';
import IndexTTSSetupStep, { IndexTTSSetupStepData } from './IndexTTSSetupStep';
import ModelDownloadStep, { ModelDownloadStepData } from './ModelDownloadStep';
import GpuConfigStep, { GpuConfigStepData } from './GpuConfigStep';
import ServerControlStep, { ServerControlStepData } from './ServerControlStep';
import CipherRevealText from '../components/CipherRevealText';
import { Button } from '../components/ui/button';

const CURRENT_STEP_STORAGE_KEY = 'indextts-hub:wizard-current-step';

const getStoredStep = () => {
  if (typeof window === 'undefined') {
    return 0;
  }
  const raw = window.localStorage.getItem(CURRENT_STEP_STORAGE_KEY);
  if (!raw) {
    return 0;
  }
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  const [showSetupFlow, setShowSetupFlow] = useState<boolean>(true);
  const [autoCollapsedApplied, setAutoCollapsedApplied] = useState<boolean>(false);

  const isMacOS = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const shouldShowGpuStep = hasDedicatedGpu === 'yes' && !isMacOS;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(CURRENT_STEP_STORAGE_KEY, currentStep.toString());
  }, [currentStep]);

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
    console.log('Wizard completed!', data);
  };

  const setupSteps = [
    {
      name: 'Welcome',
      component: (
        <WelcomeStep onNext={handleWelcomeStepNext} initialData={{ networkEnvironment, hasDedicatedGpu }} />
      ),
    },
    {
      name: 'Environment Check',
      component: <EnvCheckStep onNext={handleEnvCheckStepNext} initialData={envCheckData || undefined} />,
    },
    {
      name: 'Install Tools',
      component: <InstallToolsStep onNext={handleInstallToolsStepNext} initialData={installToolsData || undefined} />,
    },
    {
      name: 'IndexTTS Setup',
      component: <IndexTTSSetupStep onNext={handleIndexTTSSetupStepNext} initialData={indexTtsSetupData || undefined} />,
    },
    {
      name: 'Model Download',
      component: <ModelDownloadStep onNext={handleModelDownloadStepNext} initialData={modelDownloadData || undefined} />,
    },
    ...(shouldShowGpuStep
      ? [
          {
            name: 'GPU Configuration',
            component: <GpuConfigStep onNext={handleGpuConfigStepNext} initialData={gpuConfigData || undefined} />,
          },
        ]
      : []),
  ];

  const serverControlStep = {
    name: 'Server Control',
    component: <ServerControlStep onNext={handleServerControlStepNext} initialData={serverControlData || undefined} />,
  };

  const steps = setupSteps;

  const allSetupComplete = useMemo(() => {
    const envChecked = Boolean(envCheckData);
    const toolsInstalled = Boolean(installToolsData?.gitInstalled && installToolsData?.uvInstalled);
    const repoConfigured = Boolean(
      indexTtsSetupData?.repoCloned && indexTtsSetupData?.envSetup && indexTtsSetupData?.repoDir,
    );
    const modelReady = Boolean(modelDownloadData?.modelDownloaded);
    const gpuReady = !shouldShowGpuStep || Boolean(gpuConfigData);
    return envChecked && toolsInstalled && repoConfigured && modelReady && gpuReady;
  }, [
    envCheckData,
    installToolsData,
    indexTtsSetupData,
    modelDownloadData,
    gpuConfigData,
    shouldShowGpuStep,
  ]);

  useEffect(() => {
    if (currentStep >= steps.length) {
      setCurrentStep(Math.max(steps.length - 1, 0));
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (!allSetupComplete) {
      setShowSetupFlow(true);
      setAutoCollapsedApplied(false);
      return;
    }

    if (allSetupComplete && !autoCollapsedApplied) {
      setShowSetupFlow(false);
      setAutoCollapsedApplied(true);
    }
  }, [allSetupComplete, autoCollapsedApplied]);

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

  const handleToggleSetupVisibility = () => {
    if (!allSetupComplete) {
      return;
    }
    if (showSetupFlow) {
      setShowSetupFlow(false);
      return;
    }

    setShowSetupFlow(true);
    setCurrentStep(steps.length - 1);
  };

  const progressValue = steps.length === 0 ? 0 : ((currentStep + 1) / steps.length) * 100;
  const wizardHeightStyle = { height: 'min(520px, calc(100vh - 32px))' };

  if (allSetupComplete && !showSetupFlow) {
    return (
      <div
        className="rounded-2xl border border-border/60 bg-background/85 p-4 text-foreground shadow-lg"
        style={wizardHeightStyle}
      >
        <div className="flex h-full flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={handleToggleSetupVisibility}>
              ← 安装引导
            </Button>
          </div>
          <div className="flex-1 overflow-hidden rounded-2xl border border-border/70 bg-background/90 p-3">
            {serverControlStep.component || <p>Server control step is unavailable.</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-foreground" style={wizardHeightStyle}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {currentStep > 0 && (
            <Button variant="ghost" size="sm" onClick={goToPreviousStep}>
              ← 返回
            </Button>
          )}
        </div>
        {allSetupComplete && (
          <Button variant="ghost" size="sm" onClick={handleToggleSetupVisibility}>
            跳转至服务器控制
          </Button>
        )}
      </div>
      <div className="mb-3 h-1 w-full rounded-full bg-border">
        <div
          className="h-1 rounded-full bg-primary"
          style={{ width: `${progressValue}%`, transition: 'width 200ms ease' }}
        />
      </div>
      <div className="h-full overflow-y-auto pr-1">
        {steps[currentStep]?.component || <p>Step {currentStep} not implemented yet.</p>}
      </div>
    </div>
  );
};

export default Wizard;
