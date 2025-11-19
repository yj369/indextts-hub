// src/context/WizardContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  Dispatch,
  SetStateAction,
} from 'react';
import { EnvCheckStepData } from '../pages/EnvCheckStep';
import { InstallToolsStepData } from '../pages/InstallToolsStep';
import { IndexTTSSetupStepData } from '../pages/IndexTTSSetupStep';
import { ModelDownloadStepData } from '../pages/ModelDownloadStep';
import { GpuConfigStepData } from '../pages/GpuConfigStep';
import { ServerControlStepData } from '../pages/ServerControlStep';

type NetworkEnvironment = 'overseas' | 'mainland_china';
type GpuAvailability = 'yes' | 'no' | 'unsure';

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
  const [networkEnvironment, setNetworkEnvironment] = useState<NetworkEnvironment>('mainland_china');
  const [hasDedicatedGpu, setHasDedicatedGpu] = useState<GpuAvailability>('unsure');
  const [indexTtsRepoDir, setIndexTtsRepoDir] = useState<string | null>(null);
  const [useFp16, setUseFp16] = useState<boolean>(false);
  const [useDeepspeed, setUseDeepspeed] = useState<boolean>(false);
  const [envCheckData, setEnvCheckData] = useState<EnvCheckStepData | null>(null);
  const [installToolsData, setInstallToolsData] = useState<InstallToolsStepData | null>(null);
  const [indexTtsSetupData, setIndexTtsSetupData] = useState<IndexTTSSetupStepData | null>(null);
  const [modelDownloadData, setModelDownloadData] = useState<ModelDownloadStepData | null>(null);
  const [gpuConfigData, setGpuConfigData] = useState<GpuConfigStepData | null>(null);
  const [serverControlData, setServerControlData] = useState<ServerControlStepData | null>(null);

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
