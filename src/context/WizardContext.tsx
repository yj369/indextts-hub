// src/context/WizardContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
  useEffect,
} from 'react';
import { EnvCheckStepData } from '../pages/EnvCheckStep';
import { InstallToolsStepData } from '../pages/InstallToolsStep';
import { IndexTTSSetupStepData } from '../pages/IndexTTSSetupStep';
import { ModelDownloadStepData } from '../pages/ModelDownloadStep';
import { GpuConfigStepData } from '../pages/GpuConfigStep';
import { ServerControlStepData } from '../pages/ServerControlStep';

type NetworkEnvironment = 'overseas' | 'mainland_china';
type GpuAvailability = 'yes' | 'no' | 'unsure';

const STORAGE_KEY = 'indextts-hub:wizard-state';

interface WizardSnapshot {
  networkEnvironment: NetworkEnvironment;
  hasDedicatedGpu: GpuAvailability;
  indexTtsRepoDir: string | null;
  useFp16: boolean;
  useDeepspeed: boolean;
  envCheckData: EnvCheckStepData | null;
  installToolsData: InstallToolsStepData | null;
  indexTtsSetupData: IndexTTSSetupStepData | null;
  modelDownloadData: ModelDownloadStepData | null;
  gpuConfigData: GpuConfigStepData | null;
  serverControlData: ServerControlStepData | null;
}

const loadSnapshot = (): WizardSnapshot | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as WizardSnapshot;
  } catch (error) {
    console.warn('[WizardContext] Failed to parse stored state:', error);
    return null;
  }
};

interface WizardContextType {
  networkEnvironment: NetworkEnvironment;
  setNetworkEnvironment: Dispatch<SetStateAction<NetworkEnvironment>>;
  hasDedicatedGpu: GpuAvailability;
  setHasDedicatedGpu: Dispatch<SetStateAction<GpuAvailability>>;
  indexTtsRepoDir: string | null;
  setIndexTtsRepoDir: Dispatch<SetStateAction<string | null>>;
  useFp16: boolean;
  setUseFp16: Dispatch<SetStateAction<boolean>>;
  useDeepspeed: boolean;
  setUseDeepspeed: Dispatch<SetStateAction<boolean>>;
  envCheckData: EnvCheckStepData | null;
  setEnvCheckData: Dispatch<SetStateAction<EnvCheckStepData | null>>;
  installToolsData: InstallToolsStepData | null;
  setInstallToolsData: Dispatch<SetStateAction<InstallToolsStepData | null>>;
  indexTtsSetupData: IndexTTSSetupStepData | null;
  setIndexTtsSetupData: Dispatch<SetStateAction<IndexTTSSetupStepData | null>>;
  modelDownloadData: ModelDownloadStepData | null;
  setModelDownloadData: Dispatch<SetStateAction<ModelDownloadStepData | null>>;
  gpuConfigData: GpuConfigStepData | null;
  setGpuConfigData: Dispatch<SetStateAction<GpuConfigStepData | null>>;
  serverControlData: ServerControlStepData | null;
  setServerControlData: Dispatch<SetStateAction<ServerControlStepData | null>>;
  // Add other shared state as needed
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export const WizardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [persistedSnapshot] = useState<WizardSnapshot | null>(() => loadSnapshot());

  const [networkEnvironment, setNetworkEnvironment] = useState<NetworkEnvironment>(
    persistedSnapshot?.networkEnvironment ?? 'mainland_china',
  );
  const [hasDedicatedGpu, setHasDedicatedGpu] = useState<GpuAvailability>(
    persistedSnapshot?.hasDedicatedGpu ?? 'unsure',
  );
  const [indexTtsRepoDir, setIndexTtsRepoDir] = useState<string | null>(
    persistedSnapshot?.indexTtsRepoDir ?? null,
  );
  const [useFp16, setUseFp16] = useState<boolean>(persistedSnapshot?.useFp16 ?? false);
  const [useDeepspeed, setUseDeepspeed] = useState<boolean>(persistedSnapshot?.useDeepspeed ?? false);
  const [envCheckData, setEnvCheckData] = useState<EnvCheckStepData | null>(
    persistedSnapshot?.envCheckData ?? null,
  );
  const [installToolsData, setInstallToolsData] = useState<InstallToolsStepData | null>(
    persistedSnapshot?.installToolsData ?? null,
  );
  const [indexTtsSetupData, setIndexTtsSetupData] = useState<IndexTTSSetupStepData | null>(
    persistedSnapshot?.indexTtsSetupData ?? null,
  );
  const [modelDownloadData, setModelDownloadData] = useState<ModelDownloadStepData | null>(
    persistedSnapshot?.modelDownloadData ?? null,
  );
  const [gpuConfigData, setGpuConfigData] = useState<GpuConfigStepData | null>(
    persistedSnapshot?.gpuConfigData ?? null,
  );
  const [serverControlData, setServerControlData] = useState<ServerControlStepData | null>(
    persistedSnapshot?.serverControlData ?? null,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const snapshot: WizardSnapshot = {
      networkEnvironment,
      hasDedicatedGpu,
      indexTtsRepoDir,
      useFp16,
      useDeepspeed,
      envCheckData,
      installToolsData,
      indexTtsSetupData,
      modelDownloadData,
      gpuConfigData,
      serverControlData,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('[WizardContext] Failed to persist wizard state:', error);
    }
  }, [
    networkEnvironment,
    hasDedicatedGpu,
    indexTtsRepoDir,
    useFp16,
    useDeepspeed,
    envCheckData,
    installToolsData,
    indexTtsSetupData,
    modelDownloadData,
    gpuConfigData,
    serverControlData,
  ]);

  const value: WizardContextType = {
    networkEnvironment,
    setNetworkEnvironment,
    hasDedicatedGpu,
    setHasDedicatedGpu,
    indexTtsRepoDir,
    setIndexTtsRepoDir,
    useFp16,
    setUseFp16,
    useDeepspeed,
    setUseDeepspeed,
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
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
};

export const useWizard = () => {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
};
