import { act, renderHook } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import useTokenList from '@/store/tokens';
import type { MemeTarget } from '../engine/types';
import { usePaymentAssets } from './usePaymentAssets';

jest.mock('@/store/tokens', () => {
  const { create } = jest.requireActual('zustand');
  return {
    __esModule: true,
    default: create(() => ({
      tokenListMap: {},
      sourceSnapshotReadyByAddress: {},
      getTokenList: jest.fn(),
    })),
  };
});
jest.mock('@rabby-wallet/rabby-swap', () => ({
  isStableTokenPair: (token: { symbol: string }) => token.symbol === 'USDC',
}));
jest.mock('@rabby-wallet/base-utils/dist/isomorphic/address', () => ({
  isSameAddress: (a: string, b: string) => a === b,
}));
jest.mock('@/constant/swap', () => ({ SWAP_SUPPORT_CHAINS: ['HOOD', 'ETH'] }));
jest.mock('@/core/apis/provider', () => ({
  gasMarketV2: async () => [{ level: 'normal', price: 1 }],
}));
jest.mock('@/core/request', () => ({
  openapi: { getToken: async () => ({ price: 1 }) },
}));
jest.mock('@/screens/Bridge/hooks/atom', () => ({
  useBridgeSupportedChains: () => ['HOOD', 'ETH'],
}));
jest.mock('@/screens/GasAccount/hooks', () => ({
  useGasAccountInfo: () => ({ value: { account: { balance: 0 } } }),
}));
jest.mock('@/screens/Swap/utils', () => ({
  getSwapGasReserveGasLimit: () => 100000,
}));
jest.mock('@/utils/chain', () => ({
  findChainByEnum: (chainEnum: string) => ({
    serverId: chainEnum.toLowerCase(),
  }),
  findChainByServerID: (serverId: string) => ({
    serverId,
    enum: serverId.toUpperCase(),
    nativeTokenAddress: serverId,
    nativeTokenDecimals: 18,
  }),
}));
jest.mock('@/utils/lpToken', () => ({ defaultTokenFilter: () => true }));

const ADDRESS = '0xAbC';
const KEY = ADDRESS.toLowerCase();
const account = { address: ADDRESS } as Account;
const memes: MemeTarget[] = [
  { id: '0xmeme', chain: 'hood', symbol: 'MEME', marketCap: 1 },
];
const memeTokenKeys = new Set(['hood:0xmeme']);

const hoodEth = {
  id: 'hood',
  chain: 'hood',
  symbol: 'ETH',
  price: 1,
  usd_value: 90,
};
const ethUsdc = {
  id: '0xusdc',
  chain: 'eth',
  symbol: 'USDC',
  price: 1,
  usd_value: 100,
};

const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const render = () =>
  renderHook(() =>
    usePaymentAssets({ account, memes, memeTokenKeys, amountUsd: 1 }),
  );

const setStore = (
  state: Partial<{
    tokenListMap: Record<string, unknown>;
    sourceSnapshotReadyByAddress: Record<string, true>;
    getTokenList: () => Promise<void>;
  }>,
) =>
  (useTokenList as unknown as { setState(s: unknown): void }).setState(state);

const never = () => new Promise<void>(() => undefined);

describe('usePaymentAssets ready', () => {
  beforeEach(() => {
    setStore({
      tokenListMap: {},
      sourceSnapshotReadyByAddress: {},
      getTokenList: never,
    });
  });

  it('keeps loading on a partial list until the complete one arrives', async () => {
    setStore({ tokenListMap: { [KEY]: [hoodEth] } });
    const { result } = render();
    await flush();
    expect(result.current.ready).toBe(false);

    await act(async () => {
      setStore({
        tokenListMap: { [KEY]: [hoodEth, ethUsdc] },
        sourceSnapshotReadyByAddress: { [KEY]: true },
      });
    });
    await flush();
    expect(result.current.ready).toBe(true);
    expect(result.current.assets.map(a => a.chain)).toEqual(['eth', 'hood']);
  });

  it('shows a complete list at once while it refreshes in the background', async () => {
    setStore({
      tokenListMap: { [KEY]: [hoodEth, ethUsdc] },
      sourceSnapshotReadyByAddress: { [KEY]: true },
    });
    const { result } = render();
    await flush();
    expect(result.current.ready).toBe(true);
    expect(result.current.assets).toHaveLength(2);
  });

  it('shows what it has when the refresh fails', async () => {
    setStore({
      tokenListMap: { [KEY]: [hoodEth] },
      getTokenList: () => Promise.reject(new Error('network')),
    });
    const { result } = render();
    await flush();
    expect(result.current.ready).toBe(true);
    expect(result.current.assets).toHaveLength(1);
  });

  it('does not load forever when the refresh fails with no list at all', async () => {
    setStore({ getTokenList: () => Promise.reject(new Error('network')) });
    const { result } = render();
    await flush();
    expect(result.current.ready).toBe(true);
    expect(result.current.assets).toEqual([]);
  });
});
