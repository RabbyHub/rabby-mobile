import type { ComponentType } from 'react';

export const CORE_REGRESSION_SCENARIO_IDS = [
  'wallet-onboarding',
  'wallet-create',
  'wallet-backup',
  'lock-unlock',
  'address-switch',
  'home-assets',
  'single-address',
  'token-detail',
  'send-receive',
  'send-transfer',
  'swap-bridge',
  'swap-funded',
  'settings-restart',
  'app-background-restore',
] as const;

export const FOCUSED_REGRESSION_SCENARIO_IDS = [
  'dapp-browser',
  'dapp-connect',
  'dapp-switch-chain',
  'dapp-disconnect',
  'dapp-sign-tx',
  'dapp-sign-text',
  'dapp-sign-typed-data',
  'dapp-cancel-signing',
  'lending-markets',
  'perps-entry',
  'sync-extension-password',
  'transaction-history',
  'gas-account-entry',
  'send-entry-profile',
  'send-token-selector-entry',
  'market-entry',
  'approvals-entry',
  'rabby-points-entry',
  'convert-dust-entry',
] as const;

export const REGRESSION_SCENARIO_IDS = [
  ...CORE_REGRESSION_SCENARIO_IDS,
  ...FOCUSED_REGRESSION_SCENARIO_IDS,
] as const;

export type CoreRegressionScenarioId =
  (typeof CORE_REGRESSION_SCENARIO_IDS)[number];
export type FocusedRegressionScenarioId =
  (typeof FOCUSED_REGRESSION_SCENARIO_IDS)[number];
export type RegressionScenarioId = (typeof REGRESSION_SCENARIO_IDS)[number];

export const REGRESSION_SCREEN_IDS = [
  'Home',
  'Unlock',
  'SingleAddressHome',
  'TokenDetail',
  'Send',
  'Receive',
  'SwapBridge',
  'Settings',
  'GasAccount',
  'Market',
  'ApprovalAddressList',
  'Points',
  'ConvertDust',
  'BrowserScreen',
  'Lending',
  'Perps',
  'SyncExtensionPassword',
  'MultiAddressHistory',
] as const;

export type RegressionScreenId = (typeof REGRESSION_SCREEN_IDS)[number];

export const REGRESSION_SCENARIO_ACTIONS = [
  'configure',
  'start',
  'prepare',
  'open',
  'observe',
  'finish',
  'status',
  'cancel',
  'clear-session',
] as const;

export type RegressionScenarioAction =
  (typeof REGRESSION_SCENARIO_ACTIONS)[number];

export const REGRESSION_CREDENTIAL_PROFILES = ['regression-default'] as const;
export type RegressionCredentialProfile =
  (typeof REGRESSION_CREDENTIAL_PROFILES)[number];

export type RegressionScenarioCommand = {
  mode: 'lifecycle-e2e';
  action: RegressionScenarioAction;
  commandId: string;
  runId: string;
  scenario?: RegressionScenarioId;
  screen?: RegressionScreenId;
  fixture?: string;
  credentialProfile?: RegressionCredentialProfile;
  persistAcrossLaunches: boolean;
  expiresAt: number;
  remainingLaunches: number;
  params: Readonly<Record<string, string>>;
};

export type RegressionScenarioStatus =
  | 'inactive'
  | 'armed'
  | 'preparing'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled';

export type RegressionScenarioEventName =
  | 'command-received'
  | 'command-rejected'
  | 'session-restored'
  | 'session-cleared'
  | 'scenario-preparing'
  | 'scenario-running'
  | 'scenario-passed'
  | 'scenario-failed'
  | 'precondition-ready'
  | 'action-started'
  | 'postcondition-ready'
  | 'screen-mounted'
  | 'screen-visible'
  | 'screen-hidden'
  | 'screen-unmounted'
  | 'route-changed'
  | 'assertion'
  | 'perf-window-start'
  | 'perf-window-end'
  | 'perf-mark'
  | 'perf-js-gap'
  | 'fixture-loaded'
  | 'fixture-removed'
  | 'auto-lock-armed'
  | 'auto-lock-observed'
  | 'auto-lock-verified';

export type RegressionScenarioEvent = {
  sequence: number;
  timestamp: number;
  runId: string;
  scenario?: RegressionScenarioId;
  screen?: RegressionScreenId;
  name: RegressionScenarioEventName;
  data?: Readonly<Record<string, unknown>>;
};

export type RegressionScenarioSession = {
  version: 1;
  command: RegressionScenarioCommand;
  status: Exclude<RegressionScenarioStatus, 'inactive'>;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
};

export type RegressionScenarioRuntimeSnapshot = {
  revision: number;
  enabled: boolean;
  status: RegressionScenarioStatus;
  command: RegressionScenarioCommand | null;
  session: RegressionScenarioSession | null;
  events: readonly RegressionScenarioEvent[];
  lastError: string | null;
};

export type InactiveRegressionScenarioContext = {
  active: false;
};

export type ActiveRegressionScenarioContext<
  TScreen extends RegressionScreenId = RegressionScreenId,
> = {
  active: true;
  runId: string;
  scenario: RegressionScenarioId;
  screen: TScreen;
  action: RegressionScenarioAction;
  fixture?: string;
  credentialProfile?: RegressionCredentialProfile;
  params: Readonly<Record<string, string>>;
  claimOnce: (actionKey: string) => boolean;
  report: (
    name: RegressionScenarioEventName,
    data?: Readonly<Record<string, unknown>>,
  ) => void;
};

export type RegressionScenarioContext<
  TScreen extends RegressionScreenId = RegressionScreenId,
> =
  | InactiveRegressionScenarioContext
  | ActiveRegressionScenarioContext<TScreen>;

export type ActiveRegressionScenarioRuntimeContext = Omit<
  ActiveRegressionScenarioContext,
  'screen'
> & {
  screen?: RegressionScreenId;
};

export type RegressionScenarioRuntimeContext =
  | InactiveRegressionScenarioContext
  | ActiveRegressionScenarioRuntimeContext;

export type RegressionScenarioScreenOptions<
  TInjectedProps extends object = {},
> = {
  screen: RegressionScreenId;
  injectProps?: (context: ActiveRegressionScenarioContext) => TInjectedProps;
  displayName?: string;
};

export type WithRegressionScenario = <
  TProps extends object,
  TInjectedProps extends object = {},
>(
  Component: ComponentType<TProps>,
  options: RegressionScenarioScreenOptions<TInjectedProps>,
) => ComponentType<Omit<TProps, keyof TInjectedProps>>;

export const INACTIVE_REGRESSION_SCENARIO_CONTEXT =
  Object.freeze<InactiveRegressionScenarioContext>({
    active: false,
  });
