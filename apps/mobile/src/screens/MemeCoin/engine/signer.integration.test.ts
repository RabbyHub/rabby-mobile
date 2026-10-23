import 'reflect-metadata';
import { EventEmitter } from 'events';
import axios from 'axios';
import type { TypedTransaction } from '@ethereumjs/tx';
import { bytesToHex, hexToBytes } from '@ethereumjs/util';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { makeMemoryStorage } from '@rabby-wallet/persist-store/dist/storageAdapter';

import type { Account } from '@/core/startupServices/preference';
import type { CoreServiceRegistry } from '@/core/services/serviceRegistry';

// Native/ESM-only modules pulled in transitively by the MiniSign service graph;
// each one is required for the suite to load in Node.
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@onekeyfe/hd-ble-sdk', () => ({}));
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
}));
jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: () => {
      throw new Error('No Safe signing in headless signer tests');
    },
  }),
  { virtual: true },
);
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: { GRANTED: 'granted' },
  checkMultiple: jest.fn(),
  requestMultiple: jest.fn(),
}));
// Import-time startup work (deferred startup tasks, the Ledger queue) schedules
// timers. Capture them on a fake clock that is discarded unadvanced so they
// stay dormant instead of firing after the Jest environment is torn down.
jest.useFakeTimers();
const { MINI_SIGN_ERROR } =
  require('@/components2024/MiniSignV2/state/SignatureManager') as typeof import('@/components2024/MiniSignV2/state/SignatureManager');
const { openapi } =
  require('@/core/request') as typeof import('@/core/request');
// The integration test intentionally constructs real runtime services.
/* eslint-disable no-runtime-service-imports */
const { CustomRPCService } =
  require('@/core/services/customRPCService') as typeof import('@/core/services/customRPCService');
const { NotificationService } =
  require('@/core/services/notification') as typeof import('@/core/services/notification');
const { TransactionHistoryService } =
  require('@/core/services/transactionHistory') as typeof import('@/core/services/transactionHistory');
const { registerService } =
  require('@/core/services/serviceRegistry') as typeof import('@/core/services/serviceRegistry');
/* eslint-enable no-runtime-service-imports */
const walletUnlock =
  require('@/utils/walletUnlock') as typeof import('@/utils/walletUnlock');
const { createHeadlessDirectSigner } =
  require('./signer') as typeof import('./signer');
jest.useRealTimers();

// Well-known Hardhat test account #0; never holds real funds.
const PRIVATE_KEY = hexToBytes(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);
const account: Account = {
  address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  type: KEYRING_TYPE.SimpleKeyring,
  brandName: KEYRING_TYPE.SimpleKeyring,
};
const ETH_CHAIN_ID = 1;
const BASE_NONCE = 7;
const GWEI = 1e9;
const HANG_GUARD_MS = 30_000;
const HANG_GUARD_STEP_MS = 100;

const memeTxs = (): Tx[] => [
  // approve(router, max)
  {
    chainId: ETH_CHAIN_ID,
    from: account.address,
    to: '0x1111111111111111111111111111111111111111',
    value: '0x0',
    data:
      '0x095ea7b3' +
      '0000000000000000000000002222222222222222222222222222222222222222' +
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  } as Tx,
  // router swap
  {
    chainId: ETH_CHAIN_ID,
    from: account.address,
    to: '0x2222222222222222222222222222222222222222',
    value: '0x0',
    data: '0x12345678',
  } as Tx,
];

type ChainScenario = {
  gasPriceWei: number;
  preExecSuccess: boolean;
  preExecRequestError?: Error;
  broadcastError?: Error;
};

const toHex = (value: number | bigint) => `0x${value.toString(16)}`;

/**
 * Stateful fake of the Rabby backend + chain RPC reached through `openapi`
 * (the HTTP boundary). Every other openapi method rejects, so an unexpected
 * request fails loudly instead of silently resolving.
 */
function installNetworkBoundary(
  scenario: ChainScenario,
  signed: Map<string, TypedTransaction>,
) {
  const broadcasts: string[] = [];
  const unexpected: string[] = [];
  const handlers: Record<string, (...args: any[]) => unknown> = {
    ethRpc: async (_chainServerId: string, { method }: { method: string }) => {
      switch (method) {
        case 'eth_getBalance':
          return toHex(10n * 10n ** 18n);
        case 'eth_getTransactionCount':
          return toHex(BASE_NONCE);
        case 'eth_getBlockByNumber':
          return {
            number: '0x1',
            gasLimit: toHex(30_000_000),
            baseFeePerGas: toHex(scenario.gasPriceWei),
          };
        default:
          throw new Error(`Unexpected RPC ${method}`);
      }
    },
    gasMarketV2: async () =>
      (['slow', 'normal', 'fast'] as const)
        .map(level => ({
          level,
          price: scenario.gasPriceWei,
          front_tx_count: 0,
          estimated_seconds: 12,
          base_fee: scenario.gasPriceWei,
          priority_price: null,
        }))
        .concat({
          level: 'custom' as any,
          price: 0,
          front_tx_count: 0,
          estimated_seconds: 0,
          base_fee: scenario.gasPriceWei,
          priority_price: null,
        }),
    gasPriceStats: async () => ({ median: scenario.gasPriceWei }),
    historyGasUsed: async () => ({ gas_used: 0 }),
    preExecTx: async () => {
      if (scenario.preExecRequestError) {
        throw scenario.preExecRequestError;
      }
      return {
        pre_exec_version: 'v2',
        pre_exec: scenario.preExecSuccess
          ? { success: true, error: null }
          : {
              success: false,
              error: { code: 1, msg: 'execution reverted' },
            },
        gas: {
          success: true,
          gas_used: 120_000,
          gas_limit: 150_000,
          gas_ratio: 1.5,
        },
        native_token: { price: 3_000 },
        balance_change: {
          success: true,
          error: null,
          send_token_list: [],
          receive_token_list: [],
          send_nft_list: [],
          receive_nft_list: [],
          usd_value_change: 0,
        },
        is_gnosis: false,
        trace_id: 'integration-trace',
      };
    },
    gasLessTxsCheck: async () => ({ is_gasless: false }),
    parseTx: async () => ({
      action: { type: 'integration_unknown', data: null },
      contract_call: null,
    }),
    submitTxV2: async (params: { context: { tx: Tx } }) => {
      if (scenario.broadcastError) {
        throw scenario.broadcastError;
      }
      const nonce = String(params.context.tx.nonce);
      const signedTx = signed.get(nonce);
      if (!signedTx) {
        throw new Error(`Backend received unsigned tx with nonce ${nonce}`);
      }
      const hash = bytesToHex(signedTx.hash());
      broadcasts.push(nonce);
      return { req: { id: `req-${nonce}` }, tx_id: hash };
    },
  };

  const target = openapi as unknown as Record<string, unknown>;
  for (const name of Object.keys(target)) {
    if (typeof target[name] !== 'function') {
      continue;
    }
    jest.spyOn(target as any, name).mockImplementation((...args: any[]) => {
      const handler = handlers[name];
      if (handler) {
        return handler(...args);
      }
      unexpected.push(name);
      return Promise.reject(new Error(`Unexpected openapi.${name} request`));
    });
  }

  return { broadcasts, unexpected };
}

/**
 * Keyring boundary: lock state plus native signing. Signing is real secp256k1
 * over the transaction the provider controller built.
 */
function createKeyringBoundary(options: {
  unlocked: boolean;
  signError?: Error;
}) {
  const signed = new Map<string, TypedTransaction>();
  // The real KeyringService is an EventEmitter; app modules bind to it on
  // registration.
  const service = Object.assign(new EventEmitter(), {
    isUnlocked: () => options.unlocked,
    isBooted: () => true,
    isKeyringRuntimeReady: () => options.unlocked,
    ensureKeyringRuntimeReady: async () => undefined,
    hasAddress: async (address: string) =>
      address.toLowerCase() === account.address,
    getKeyringForAccount: async (_address: string, type: string) => ({ type }),
    signTransaction: async (_keyring: unknown, tx: TypedTransaction) => {
      if (options.signError) {
        throw options.signError;
      }
      const signedTx = tx.sign(PRIVATE_KEY);
      signed.set(toHex(signedTx.nonce), signedTx);
      return signedTx;
    },
  });
  return {
    signed,
    service: service as unknown as CoreServiceRegistry['keyringService'],
  };
}

type Outcome =
  | { status: 'resolved'; value: unknown }
  | { status: 'rejected'; reason: unknown }
  | { status: 'pending' };

/**
 * Drives the fake clock until the promise settles. A promise still pending
 * after HANG_GUARD_MS of fake time is reported as `pending`, so a hang fails
 * the assertion immediately instead of freezing the lane.
 */
async function settleWithin(promise: Promise<unknown>) {
  let outcome: Outcome = { status: 'pending' };
  promise.then(
    value => {
      outcome = { status: 'resolved', value };
    },
    reason => {
      outcome = { status: 'rejected', reason };
    },
  );
  for (
    let elapsed = 0;
    outcome.status === 'pending' && elapsed <= HANG_GUARD_MS;
    elapsed += HANG_GUARD_STEP_MS
  ) {
    await jest.advanceTimersByTimeAsync(HANG_GUARD_STEP_MS);
  }
  return outcome;
}

const reasonText = (outcome: Outcome) =>
  outcome.status === 'rejected'
    ? outcome.reason instanceof Error
      ? outcome.reason.message
      : String(outcome.reason)
    : outcome.status;

describe('MemeCoin headless direct signer integration', () => {
  let cleanups: Array<() => void> = [];

  const setup = (
    scenario: Partial<ChainScenario> & {
      unlocked?: boolean;
      signError?: Error;
    } = {},
  ) => {
    const keyring = createKeyringBoundary({
      unlocked: scenario.unlocked ?? true,
      signError: scenario.signError,
    });
    const network = installNetworkBoundary(
      {
        gasPriceWei: 1 * GWEI,
        preExecSuccess: true,
        ...scenario,
      },
      keyring.signed,
    );
    const transactionHistoryService = new TransactionHistoryService({
      storageAdapter: makeMemoryStorage(),
    } as ConstructorParameters<typeof TransactionHistoryService>[0]);
    cleanups.push(
      registerService('keyringService', keyring.service),
      registerService(
        'customRPCService',
        new CustomRPCService({ storageAdapter: makeMemoryStorage() }),
      ),
      registerService('transactionHistoryService', transactionHistoryService),
      registerService(
        'notificationService',
        new NotificationService({
          preferenceService: undefined,
          transactionHistoryService,
        }),
      ),
    );
    if (scenario.unlocked === false) {
      // The wallet is locked and the user dismisses the unlock prompt. The
      // prompt itself (keychain/biometrics or password sheet) needs a native
      // and modal host that a headless Node test cannot mount.
      jest
        .spyOn(walletUnlock, 'ensureWalletUnlockedForAction')
        .mockResolvedValue(false);
    }
    return { keyring, network, transactionHistoryService };
  };

  // Same call order as legRunner.signAndBroadcast: prefetch, openDirect, close.
  const runLeg = async (txs: Tx[]) => {
    const signer = createHeadlessDirectSigner({ account });
    try {
      return await settleWithin(
        (async () => {
          await signer.prefetch(txs);
          return signer.openDirect(txs);
        })(),
      );
    } finally {
      signer.close();
    }
  };

  const axiosGet = jest.mocked(axios.get);
  const defaultAxiosGet = axiosGet.getMockImplementation();

  beforeEach(() => {
    // A fresh fake clock per scenario; timers the flow leaves behind (e.g.
    // the 150s RPC cache expiry) are dropped with it in afterEach.
    jest.useFakeTimers();
    // CustomRPCService syncs the default RPC list over plain HTTP; an empty
    // list routes chain RPC through openapi.ethRpc.
    axiosGet.mockResolvedValue({ data: { rpcs: [] } });
    (['log', 'info', 'debug', 'warn', 'error'] as const).forEach(level =>
      jest.spyOn(console, level).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    cleanups.reverse().forEach(cleanup => cleanup());
    cleanups = [];
    jest.restoreAllMocks();
    axiosGet.mockImplementation(defaultAxiosGet);
    jest.useRealTimers();
  });

  it('resolves with the broadcast hashes without a mounted MiniSign UI', async () => {
    const { keyring, network, transactionHistoryService } = setup();

    const outcome = await runLeg(memeTxs());

    // Hashes of the transactions the keyring signed, in signing order.
    const signedHashes = [...keyring.signed.values()].map(tx =>
      bytesToHex(tx.hash()),
    );
    expect(outcome).toEqual({ status: 'resolved', value: signedHashes });
    expect(signedHashes).toHaveLength(2);
    expect(network.broadcasts).toEqual([
      toHex(BASE_NONCE),
      toHex(BASE_NONCE + 1),
    ]);
    expect(
      transactionHistoryService
        .getList(account.address)
        .pendings.map(group => group.nonce)
        .sort(),
    ).toEqual([BASE_NONCE, BASE_NONCE + 1]);
    expect(network.unexpected).toEqual([]);
  });

  it.each([
    {
      name: 'pre-exec simulation reports failure',
      scenario: { preExecSuccess: false },
      reason: MINI_SIGN_ERROR.PREFETCH_FAILURE,
    },
    {
      name: 'the pre-exec request fails',
      scenario: { preExecRequestError: new Error('pre-exec 502') },
      reason: MINI_SIGN_ERROR.PREFETCH_FAILURE,
    },
    {
      name: 'gas fee exceeds the MiniSign threshold',
      scenario: { gasPriceWei: 100 * GWEI },
      reason: MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
    },
    {
      name: 'wallet unlock is refused',
      scenario: { unlocked: false },
      reason: MINI_SIGN_ERROR.USER_CANCELLED,
    },
  ])('rejects without signing when $name', async ({ scenario, reason }) => {
    const { keyring, network } = setup(scenario);

    const outcome = await runLeg(memeTxs());

    expect(outcome.status).toBe('rejected');
    expect(reasonText(outcome)).toBe(reason);
    expect(keyring.signed.size).toBe(0);
    expect(network.broadcasts).toEqual([]);
    expect(network.unexpected).toEqual([]);
  });

  it.each([
    {
      name: 'the keyring fails to sign',
      scenario: { signError: new Error('Keyring signing failed') },
      reason: 'Keyring signing failed',
      signedCount: 0,
    },
    {
      name: 'the backend rejects the broadcast',
      scenario: { broadcastError: new Error('nonce too low') },
      reason: 'nonce too low',
      // The batch stops at the first failed broadcast.
      signedCount: 1,
    },
  ])('rejects when $name', async ({ scenario, reason, signedCount }) => {
    const { keyring, network } = setup(scenario);

    const outcome = await runLeg(memeTxs());

    expect(outcome.status).toBe('rejected');
    expect(reasonText(outcome)).toBe(reason);
    expect(keyring.signed.size).toBe(signedCount);
    expect(network.broadcasts).toEqual([]);
    expect(network.unexpected).toEqual([]);
  });
});
