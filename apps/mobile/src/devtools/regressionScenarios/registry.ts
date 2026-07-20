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
  'app-background-restore': () => import('./scenarios/coreNavigation'),
  'dapp-browser': () => import('./scenarios/focused'),
  'dapp-connect': () => import('./scenarios/focused'),
  'dapp-switch-chain': () => import('./scenarios/focused'),
  'dapp-disconnect': () => import('./scenarios/focused'),
  'dapp-sign-tx': () => import('./scenarios/focused'),
  'dapp-sign-text': () => import('./scenarios/focused'),
  'dapp-sign-typed-data': () => import('./scenarios/focused'),
  'dapp-cancel-signing': () => import('./scenarios/focused'),
  'lending-markets': () => import('./scenarios/focused'),
  'perps-entry': () => import('./scenarios/focused'),
  'sync-extension-password': () => import('./scenarios/focused'),
  'transaction-history': () => import('./scenarios/focused'),
  'gas-account-entry': () => import('./scenarios/focused'),
  'send-token-selector-entry': () => import('./scenarios/focused'),
  'market-entry': () => import('./scenarios/focused'),
  'approvals-entry': () => import('./scenarios/focused'),
  'rabby-points-entry': () => import('./scenarios/focused'),
  'convert-dust-entry': () => import('./scenarios/focused'),
};

export function loadRegressionScenarioModule(scenario: RegressionScenarioId) {
  return SCENARIO_MODULE_LOADERS[scenario]();
}
