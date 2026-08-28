import type { RegressionScenarioId, RegressionScreenId } from './contracts';

export type RegressionScenarioMetadata = {
  id: RegressionScenarioId;
  kind: 'core' | 'focused' | 'experimental';
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
  'high-cardinality-assets': {
    id: 'high-cardinality-assets',
    kind: 'experimental',
    screens: ['Home'],
    requiresFixture: true,
    description:
      'Import a bounded Watch-address fixture through the normal address API and exercise Home asset loading with the configured non-production Top-N selection policy.',
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
    description:
      'Prepare a low-value Polygon to Arbitrum Bridge and validate dry-run readiness.',
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
  'app-background-restore': {
    id: 'app-background-restore',
    kind: 'core',
    screens: ['Home'],
    requiresFixture: false,
    description:
      'Open Home, then let the host runner background and restore the app.',
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
  'dapp-switch-chain': {
    id: 'dapp-switch-chain',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Send a deterministic Dapp wallet_switchEthereumChain request and verify the connected Dapp chain changes.',
  },
  'dapp-disconnect': {
    id: 'dapp-disconnect',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Connect a deterministic Dapp, revoke eth_accounts permission through provider flow, and verify it is disconnected.',
  },
  'dapp-sign-tx': {
    id: 'dapp-sign-tx',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Send a deterministic Dapp eth_sendTransaction request and verify SignTx approval opens without broadcasting.',
  },
  'dapp-sign-text': {
    id: 'dapp-sign-text',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Send a deterministic Dapp personal_sign request and verify SignText approval opens without signing.',
  },
  'dapp-sign-typed-data': {
    id: 'dapp-sign-typed-data',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Send a deterministic Dapp eth_signTypedData_v4 request and verify SignTypedData approval opens without signing.',
  },
  'dapp-cancel-signing': {
    id: 'dapp-cancel-signing',
    kind: 'focused',
    screens: ['BrowserScreen'],
    requiresFixture: false,
    description:
      'Open a deterministic Dapp signing approval, cancel it, and verify the approval queue is cleared.',
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
  'gas-account-entry': {
    id: 'gas-account-entry',
    kind: 'focused',
    screens: ['GasAccount'],
    requiresFixture: false,
    description: 'Open GasAccount from the transaction stack.',
  },
  'send-entry-profile': {
    id: 'send-entry-profile',
    kind: 'focused',
    screens: ['Send'],
    requiresFixture: false,
    description:
      'Profile Send navigation and its first screen initialization window.',
  },
  'send-token-selector-entry': {
    id: 'send-token-selector-entry',
    kind: 'focused',
    screens: ['Send'],
    requiresFixture: false,
    description:
      'Open the Send token selector repeatedly and capture its main-runtime profile.',
  },
  'market-entry': {
    id: 'market-entry',
    kind: 'focused',
    screens: ['Market'],
    requiresFixture: false,
    description: 'Open the Market screen from the home non-tab stack.',
  },
  'approvals-entry': {
    id: 'approvals-entry',
    kind: 'focused',
    screens: ['ApprovalAddressList'],
    requiresFixture: false,
    description: 'Open the Approvals address list entry point.',
  },
  'rabby-points-entry': {
    id: 'rabby-points-entry',
    kind: 'focused',
    screens: ['Points'],
    requiresFixture: false,
    description: 'Open the Rabby Points screen.',
  },
  'convert-dust-entry': {
    id: 'convert-dust-entry',
    kind: 'focused',
    screens: ['ConvertDust'],
    requiresFixture: false,
    description: 'Open the Convert Dust screen.',
  },
});

export function scenarioIncludesScreen(
  scenario: RegressionScenarioId,
  screen: RegressionScreenId,
) {
  return REGRESSION_SCENARIO_METADATA[scenario].screens.includes(screen);
}
