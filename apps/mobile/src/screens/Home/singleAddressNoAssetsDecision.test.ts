import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

import type { KeyringAccountWithAlias } from '@/types/account';
import type { getShowReceiveAddressTip } from '@/screens/Address/components/MultiAssets/hooks';

jest.mock('@/core/serviceApi/customTestnet', () => ({
  customTestnetServiceApi: {
    getList: jest.fn(),
  },
}));
jest.mock('@/screens/Address/components/MultiAssets/hooks', () => ({
  getShowReceiveAddressTip: jest.fn(),
}));

import {
  loadSingleAddressNoAssetsDecision,
  resolveSingleAddressAssetViewState,
  shouldResolveSingleAddressNoAssets,
} from './singleAddressNoAssetsDecision';

const account = {
  address: '0x1234',
  type: KEYRING_TYPE.SimpleKeyring,
  brandName: 'Rabby',
} as KeyringAccountWithAlias;

type ReceiveTipResult = Awaited<ReturnType<typeof getShowReceiveAddressTip>>;

describe('single-address no-assets decision', () => {
  it('waits for a possible no-assets account instead of mounting asset tabs', () => {
    const shouldResolveNoAssets = shouldResolveSingleAddressNoAssets({
      account,
      chainLength: 0,
      customTestnetCount: 0,
      evmBalance: 0,
    });

    expect(shouldResolveNoAssets).toBe(true);
    expect(
      resolveSingleAddressAssetViewState({
        hasCurrentAccount: true,
        hasNetworkError: false,
        shouldResolveNoAssets,
        decision: { account: null, status: 'pending' },
      }),
    ).toBe('pending');
  });

  it.each([
    ['known balance', 0, 0, 1],
    ['known chain assets', 1, 0, 0],
    ['custom testnet', 0, 1, 0],
  ])(
    'renders assets immediately when %s rules out the receive state',
    (_name, chainLength, customTestnetCount, evmBalance) => {
      expect(
        shouldResolveSingleAddressNoAssets({
          account,
          chainLength,
          customTestnetCount,
          evmBalance,
        }),
      ).toBe(false);
    },
  );

  it('renders assets immediately for accounts that cannot receive the tip', () => {
    expect(
      shouldResolveSingleAddressNoAssets({
        account: {
          ...account,
          type: KEYRING_TYPE.WatchAddressKeyring,
        },
        chainLength: 0,
        customTestnetCount: 0,
        evmBalance: 0,
      }),
    ).toBe(false);
  });

  it('selects the receive state only after every decision source agrees', async () => {
    const receiveAccount = await loadSingleAddressNoAssetsDecision(account, {
      getReceiveTip: jest.fn(async () => ({
        targetAccount: account,
        evmBalance: 0,
        appChainHasBalance: false,
        borned: false,
      })),
      getCustomTestnetList: jest.fn(async () => []),
    });

    expect(receiveAccount).toBe(account);
    expect(
      resolveSingleAddressAssetViewState({
        hasCurrentAccount: true,
        hasNetworkError: false,
        shouldResolveNoAssets: true,
        decision: { account: receiveAccount, status: 'ready' },
      }),
    ).toBe('receive');
  });

  it('starts independent decision sources together', async () => {
    let resolveReceiveTip: (value: ReceiveTipResult) => void = () => undefined;
    let resolveCustomTestnets: (value: readonly unknown[]) => void = () =>
      undefined;
    const receiveTipPromise = new Promise<ReceiveTipResult>(resolve => {
      resolveReceiveTip = resolve;
    });
    const customTestnetPromise = new Promise<readonly unknown[]>(resolve => {
      resolveCustomTestnets = resolve;
    });
    const getReceiveTip = jest.fn(() => receiveTipPromise);
    const getCustomTestnetList = jest.fn(() => customTestnetPromise);

    const decision = loadSingleAddressNoAssetsDecision(account, {
      getReceiveTip,
      getCustomTestnetList,
    });

    expect(getReceiveTip).toHaveBeenCalledTimes(1);
    expect(getCustomTestnetList).toHaveBeenCalledTimes(1);

    resolveReceiveTip({
      targetAccount: account,
      evmBalance: 0,
      appChainHasBalance: false,
      borned: false,
    });
    resolveCustomTestnets([]);
    await expect(decision).resolves.toBe(account);
  });

  it('settles conservatively when a decision source does not respond', async () => {
    jest.useFakeTimers();
    try {
      const decision = loadSingleAddressNoAssetsDecision(account, {
        getReceiveTip: jest.fn(() => new Promise(() => undefined)),
        getCustomTestnetList: jest.fn(async () => []),
        timeoutMs: 100,
      });

      jest.advanceTimersByTime(100);
      await expect(decision).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the asset state when custom testnets disqualify the receive state', async () => {
    const receiveAccount = await loadSingleAddressNoAssetsDecision(account, {
      getReceiveTip: jest.fn(async () => ({
        targetAccount: account,
        evmBalance: 0,
        appChainHasBalance: false,
        borned: false,
      })),
      getCustomTestnetList: jest.fn(async () => [{ id: 1 }]),
    });

    expect(receiveAccount).toBeNull();
  });

  it.each([
    ['an EVM balance', { evmBalance: 1 }],
    ['an initialized address', { borned: true }],
    ['an appchain balance', { appChainHasBalance: true }],
  ])('keeps the asset state when the account has %s', async (_name, patch) => {
    const receiveAccount = await loadSingleAddressNoAssetsDecision(account, {
      getReceiveTip: jest.fn(async () => ({
        targetAccount: account,
        evmBalance: 0,
        appChainHasBalance: false,
        borned: false,
        ...patch,
      })),
      getCustomTestnetList: jest.fn(async () => []),
    });

    expect(receiveAccount).toBeNull();
  });

  it('fails closed to the asset state', () => {
    expect(
      resolveSingleAddressAssetViewState({
        hasCurrentAccount: true,
        hasNetworkError: false,
        shouldResolveNoAssets: true,
        decision: { account: null, status: 'failed' },
      }),
    ).toBe('assets');
  });

  it('keeps network errors ahead of the no-assets decision', () => {
    expect(
      resolveSingleAddressAssetViewState({
        hasCurrentAccount: true,
        hasNetworkError: true,
        shouldResolveNoAssets: true,
        decision: { account: null, status: 'pending' },
      }),
    ).toBe('network-error');
  });
});
