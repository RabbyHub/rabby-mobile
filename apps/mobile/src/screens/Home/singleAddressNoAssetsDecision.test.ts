import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import type { KeyringAccountWithAlias } from '@/types/account';
import {
  collectSingleAddressNoAssetsEvidence,
  createSingleAddressNoAssetsDecisionCoordinator,
  getSingleAddressNoAssetsDecisionKey,
  resolveSingleAddressAssetViewState,
  type SingleAddressNoAssetsEvidence,
} from './singleAddressNoAssetsDecision';

const account = {
  address: '0x1234',
  type: KEYRING_TYPE.SimpleKeyring,
  brandName: 'Rabby',
} as KeyringAccountWithAlias;

const emptyEvidence: SingleAddressNoAssetsEvidence = {
  appChainHasBalance: false,
  borned: false,
  hasCustomTestnet: false,
};

const settledZeroAssets = {
  account,
  hasNetworkError: false,
  chainLength: 0,
  customTestnetCount: 0,
  balance: 0,
  evmBalance: 0,
  balanceFlow: {
    hasValue: true,
    isLoading: false,
    hasError: false,
  },
  noAssetsDecision: {
    status: 'ready' as const,
    evidence: emptyEvidence,
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

describe('single-address no-assets decision coordinator', () => {
  it('deduplicates the active request and publishes its terminal evidence', async () => {
    const deferred = createDeferred<SingleAddressNoAssetsEvidence>();
    const loadEvidence = jest.fn(() => deferred.promise);
    const publish = jest.fn();
    const coordinator = createSingleAddressNoAssetsDecisionCoordinator({
      loadEvidence,
      publisher: { publish },
    });

    const first = coordinator.prepare(account);
    const second = coordinator.prepare(account);
    await Promise.resolve();

    expect(loadEvidence).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      getSingleAddressNoAssetsDecisionKey(account),
      { status: 'pending', evidence: null },
    );

    deferred.resolve(emptyEvidence);
    await Promise.all([first, second]);

    expect(publish).toHaveBeenLastCalledWith(
      getSingleAddressNoAssetsDecisionKey(account),
      { status: 'ready', evidence: emptyEvidence },
    );
  });

  it('rechecks settled evidence on a later page entry', async () => {
    const loadEvidence = jest.fn(async () => emptyEvidence);
    const coordinator = createSingleAddressNoAssetsDecisionCoordinator({
      loadEvidence,
      publisher: { publish: jest.fn() },
    });

    await coordinator.prepare(account);
    await coordinator.prepare(account);

    expect(loadEvidence).toHaveBeenCalledTimes(2);
  });

  it('publishes a terminal failure rather than leaving the view pending', async () => {
    const publish = jest.fn();
    const coordinator = createSingleAddressNoAssetsDecisionCoordinator({
      loadEvidence: async () => {
        throw new Error('unavailable');
      },
      publisher: { publish },
    });

    await coordinator.prepare(account);

    expect(publish).toHaveBeenLastCalledWith(
      getSingleAddressNoAssetsDecisionKey(account),
      { status: 'failed', evidence: null },
    );
  });

  it('does not request evidence for an unsupported account', async () => {
    const loadEvidence = jest.fn(async () => emptyEvidence);
    const coordinator = createSingleAddressNoAssetsDecisionCoordinator({
      loadEvidence,
      publisher: { publish: jest.fn() },
    });

    await coordinator.prepare({
      ...account,
      type: KEYRING_TYPE.WatchAddressKeyring,
    });

    expect(loadEvidence).not.toHaveBeenCalled();
  });

  it('skips an address with a known positive balance unless fresh data confirms zero', async () => {
    const loadEvidence = jest.fn(async () => emptyEvidence);
    const coordinator = createSingleAddressNoAssetsDecisionCoordinator({
      loadEvidence,
      publisher: { publish: jest.fn() },
    });
    const previouslyFundedAccount = { ...account, balance: 1 };

    await coordinator.prepare(previouslyFundedAccount);
    expect(loadEvidence).not.toHaveBeenCalled();

    await coordinator.prepare(previouslyFundedAccount, {
      ignoreAccountBalance: true,
    });
    expect(loadEvidence).toHaveBeenCalledTimes(1);
  });
});

describe('single-address no-assets evidence', () => {
  it('loads independent evidence sources concurrently and preserves each result', async () => {
    const appChains = createDeferred<readonly { netWorth: number }[]>();
    const borned = createDeferred<boolean>();
    const customTestnet = createDeferred<boolean>();
    const sources = {
      loadAppChains: jest.fn(() => appChains.promise),
      loadAddressBorned: jest.fn(() => borned.promise),
      loadHasCustomTestnet: jest.fn(() => customTestnet.promise),
    };

    const evidencePromise = collectSingleAddressNoAssetsEvidence(
      account,
      sources,
    );
    await Promise.resolve();

    expect(sources.loadAppChains).toHaveBeenCalledWith(account.address);
    expect(sources.loadAddressBorned).toHaveBeenCalledWith(account.address);
    expect(sources.loadHasCustomTestnet).toHaveBeenCalledTimes(1);

    appChains.resolve([{ netWorth: 1 }]);
    borned.resolve(false);
    customTestnet.resolve(true);

    await expect(evidencePromise).resolves.toEqual({
      appChainHasBalance: true,
      borned: false,
      hasCustomTestnet: true,
    });
  });

  it('fails closed when AppChain data cannot be resolved', async () => {
    await expect(
      collectSingleAddressNoAssetsEvidence(account, {
        loadAppChains: async () => undefined,
        loadAddressBorned: async () => false,
        loadHasCustomTestnet: async () => false,
      }),
    ).rejects.toThrow('Failed to resolve AppChain assets');
  });
});

describe('single-address no-assets view state', () => {
  it('shows the receive prompt after every required source confirms zero assets', () => {
    expect(resolveSingleAddressAssetViewState(settledZeroAssets)).toBe(
      'receive',
    );
  });

  it.each([
    [
      'balance has not started',
      {
        balance: null,
        evmBalance: null,
        balanceFlow: {
          hasValue: false,
          isLoading: false,
          hasError: false,
        },
      },
    ],
    [
      'balance is loading without a cached value',
      {
        balance: null,
        evmBalance: null,
        balanceFlow: {
          hasValue: false,
          isLoading: true,
          hasError: false,
        },
      },
    ],
    [
      'a cached zero balance is being refreshed',
      {
        balanceFlow: {
          hasValue: true,
          isLoading: true,
          hasError: false,
        },
      },
    ],
    [
      'the no-assets evidence is loading',
      {
        noAssetsDecision: {
          status: 'pending' as const,
          evidence: null,
        },
      },
    ],
  ])('keeps the decision pending while %s', (_name, patch) => {
    expect(
      resolveSingleAddressAssetViewState({
        ...settledZeroAssets,
        ...patch,
      }),
    ).toBe('pending');
  });

  it.each([
    ['the total balance is positive', { balance: 1 }],
    ['the EVM balance is positive', { evmBalance: 1 }],
    ['a chain has assets', { chainLength: 1 }],
    ['the live custom-testnet store has an entry', { customTestnetCount: 1 }],
    [
      'AppChain has assets',
      {
        noAssetsDecision: {
          status: 'ready' as const,
          evidence: { ...emptyEvidence, appChainHasBalance: true },
        },
      },
    ],
    [
      'the address has prior chain activity',
      {
        noAssetsDecision: {
          status: 'ready' as const,
          evidence: { ...emptyEvidence, borned: true },
        },
      },
    ],
    [
      'persisted custom-testnet configuration exists',
      {
        noAssetsDecision: {
          status: 'ready' as const,
          evidence: { ...emptyEvidence, hasCustomTestnet: true },
        },
      },
    ],
    [
      'balance loading failed',
      {
        balance: null,
        evmBalance: null,
        balanceFlow: {
          hasValue: false,
          isLoading: false,
          hasError: true,
        },
      },
    ],
    [
      'a cached zero balance could not be refreshed',
      {
        balanceFlow: {
          hasValue: true,
          isLoading: false,
          hasError: true,
        },
      },
    ],
    [
      'the no-assets evidence request failed',
      {
        noAssetsDecision: {
          status: 'failed' as const,
          evidence: null,
        },
      },
    ],
  ])('falls through to the asset view when %s', (_name, patch) => {
    expect(
      resolveSingleAddressAssetViewState({
        ...settledZeroAssets,
        ...patch,
      }),
    ).toBe('assets');
  });

  it('uses a positive account snapshot before the balance resource settles', () => {
    expect(
      resolveSingleAddressAssetViewState({
        ...settledZeroAssets,
        account: { ...account, balance: 1 },
        balance: null,
        evmBalance: null,
        balanceFlow: {
          hasValue: false,
          isLoading: true,
          hasError: false,
        },
      }),
    ).toBe('assets');
  });

  it('renders assets immediately for accounts that cannot receive the tip', () => {
    expect(
      resolveSingleAddressAssetViewState({
        ...settledZeroAssets,
        account: {
          ...account,
          type: KEYRING_TYPE.WatchAddressKeyring,
        },
        balance: null,
        evmBalance: null,
        balanceFlow: {
          hasValue: false,
          isLoading: true,
          hasError: false,
        },
      }),
    ).toBe('assets');
  });

  it('keeps network errors ahead of the no-assets decision', () => {
    expect(
      resolveSingleAddressAssetViewState({
        ...settledZeroAssets,
        hasNetworkError: true,
      }),
    ).toBe('network-error');
  });
});
