import type { RegressionScenarioId } from './contracts';
import type { RegressionScenarioModule } from './scenarioTypes';

type ScenarioModuleLoader = () => Promise<RegressionScenarioModule>;

const SCENARIO_MODULE_LOADERS: Record<
  RegressionScenarioId,
  ScenarioModuleLoader
> = {
  'wallet-onboarding': () => import('./scenarios/wallet'),
  'wallet-create': () => import('./scenarios/wallet'),
  'wallet-backup': () => import('./scenarios/wallet'),
  'lock-unlock': () => import('./scenarios/wallet'),
  'address-switch': () => import('./scenarios/coreNavigation'),
  'home-assets': () => import('./scenarios/coreNavigation'),
  'single-address': () => import('./scenarios/coreNavigation'),
  'token-detail': () => import('./scenarios/coreNavigation'),
  'send-receive': () => import('./scenarios/coreNavigation'),
  'send-transfer': () => import('./scenarios/coreNavigation'),
  'swap-bridge': () => import('./scenarios/coreNavigation'),
  'swap-funded': () => import('./scenarios/coreNavigation'),
  'settings-restart': () => import('./scenarios/coreNavigation'),
  'dapp-browser': () => import('./scenarios/focused'),
  'dapp-connect': () => import('./scenarios/focused'),
  'lending-markets': () => import('./scenarios/focused'),
  'perps-entry': () => import('./scenarios/focused'),
  'sync-extension-password': () => import('./scenarios/focused'),
  'transaction-history': () => import('./scenarios/focused'),
};

export function loadRegressionScenarioModule(scenario: RegressionScenarioId) {
  return SCENARIO_MODULE_LOADERS[scenario]();
}
