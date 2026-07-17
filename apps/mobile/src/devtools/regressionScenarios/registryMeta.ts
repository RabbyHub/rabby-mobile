import type { RegressionScenarioId, RegressionScreenId } from './contracts';

export type RegressionScenarioMetadata = {
  id: RegressionScenarioId;
  kind: 'core' | 'focused';
  screens: readonly RegressionScreenId[];
  requiresFixture: boolean;
  description: string;
};

export const REGRESSION_SCENARIO_METADATA = Object.freeze<
  Record<RegressionScenarioId, RegressionScenarioMetadata>
>({
  'wallet-onboarding': {
    id: 'wallet-onboarding',
    kind: 'core',
    screens: ['Home'],
    requiresFixture: true,
    description:
      'Import a fixture wallet through the production wallet setup flow.',
  },
  'wallet-create': {
    id: 'wallet-create',
    kind: 'core',
    screens: ['Home', 'SingleAddressHome'],
    requiresFixture: false,
    description:
      'Create a mnemonic wallet through the production wallet setup flow.',
  },
  'wallet-backup': {
    id: 'wallet-backup',
    kind: 'core',
    screens: ['Home'],
    requiresFixture: false,
    description:
      'Verify mnemonic backup material can be decrypted without logging the secret.',
  },
  'lock-unlock': {
    id: 'lock-unlock',
    kind: 'core',
    screens: ['Unlock', 'Home'],
    requiresFixture: false,
    description: 'Lock an initialized wallet, unlock it, and return to Home.',
  },
  'address-switch': {
    id: 'address-switch',
    kind: 'core',
    screens: ['Home'],
    requiresFixture: false,
    description: 'Switch the fallback/current account and verify it converges.',
  },
  'home-assets': {
    id: 'home-assets',
    kind: 'core',
    screens: ['Home'],
    requiresFixture: false,
    description: 'Open Home and visit the Token, DeFi, and NFT asset tabs.',
  },
  'single-address': {
    id: 'single-address',
    kind: 'core',
    screens: ['SingleAddressHome'],
    requiresFixture: false,
    description: 'Open the active account single-address home screen.',
  },
  'token-detail': {
    id: 'token-detail',
    kind: 'core',
    screens: ['TokenDetail'],
    requiresFixture: false,
    description:
      'Open Token Detail from active-account assets or deterministic native-token metadata.',
  },
  'send-receive': {
    id: 'send-receive',
    kind: 'core',
    screens: ['Send', 'Receive'],
    requiresFixture: false,
    description: 'Open Send and Receive without broadcasting a transaction.',
  },
  'send-transfer': {
    id: 'send-transfer',
    kind: 'core',
    screens: ['Send'],
    requiresFixture: false,
    description:
      'Prepare a low-value Polygon Send transfer and validate dry-run readiness.',
  },
  'swap-bridge': {
    id: 'swap-bridge',
    kind: 'core',
    screens: ['SwapBridge'],
    requiresFixture: false,
    description: 'Open Swap and Bridge with real account context.',
  },
  'swap-funded': {
    id: 'swap-funded',
    kind: 'core',
    screens: ['SwapBridge'],
    requiresFixture: false,
    description:
      'Prepare a low-value Polygon Swap and validate quote/dry-run readiness.',
  },
  'settings-restart': {
    id: 'settings-restart',
    kind: 'core',
    screens: ['Settings', 'Unlock', 'Home'],
    requiresFixture: false,
    description: 'Open Settings and verify lock/restart state restoration.',
  },
  'dapp-browser': {
    id: 'dapp-browser',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description: 'Open a configured Dapp URL in the in-app browser.',
  },
  'dapp-connect': {
    id: 'dapp-connect',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Open a configured Dapp URL and verify connected Dapp permission state.',
  },
  'lending-markets': {
    id: 'lending-markets',
    kind: 'focused',
    screens: ['Lending'],
    requiresFixture: false,
    description: 'Open and probe Core, Plasma, and MegaETH Lending markets.',
  },
  'perps-entry': {
    id: 'perps-entry',
    kind: 'focused',
    screens: ['Perps'],
    requiresFixture: false,
    description: 'Open Perps and observe warmup/data readiness.',
  },
  'sync-extension-password': {
    id: 'sync-extension-password',
    kind: 'focused',
    screens: ['SyncExtensionPassword'],
    requiresFixture: false,
    description:
      'Exercise extension password verification with test credentials.',
  },
  'transaction-history': {
    id: 'transaction-history',
    kind: 'focused',
    screens: ['MultiAddressHistory'],
    requiresFixture: false,
    description: 'Open transaction history and observe refresh completion.',
  },
});

export function scenarioIncludesScreen(
  scenario: RegressionScenarioId,
  screen: RegressionScreenId,
) {
  return REGRESSION_SCENARIO_METADATA[scenario].screens.includes(screen);
}
