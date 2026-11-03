import { act, renderHook } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import useTokenList from '@/store/tokens';
import type { AllocationMode, MemeTarget } from '../engine/types';
import { usePaymentAssets } from './usePaymentAssets';

const mockGasMarket = jest.fn();

jest.mock('@/store/tokens', () => {
  const { create } = jest.requireActual('zustand');
  return {
    __esModule: true,
    default: create(() => ({
      tokenListMap: {},
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
  gasMarketV2: (params: { chainId: string }) => mockGasMarket(params.chainId),
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
const GAS_LEVELS = [{ level: 'normal', price: 1 }];

const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const render = (amountUsd = 1) =>
  renderHook(() =>
    usePaymentAssets({
      account,
      memes,
      memeTokenKeys,
      amountUsd,
      allocationMode: 'marketCap',
    }),
  );

const setStore = (
  state: Partial<{
    tokenListMap: Record<string, unknown>;
    getTokenList: () => Promise<void>;
  }>,
) =>
  (useTokenList as unknown as { setState(s: unknown): void }).setState(state);

const never = <T>() => new Promise<T>(() => undefined);

describe('usePaymentAssets', () => {
  beforeEach(() => {
    mockGasMarket.mockReset();
    mockGasMarket.mockResolvedValue(GAS_LEVELS);
    setStore({ tokenListMap: {}, getTokenList: never });
  });

  describe('listReady', () => {
    it('shows the list without waiting for gas or the refresh', async () => {
      mockGasMarket.mockImplementation(() => never());
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      const { result } = render();
      await flush();
      expect(result.current.listReady).toBe(true);
      expect(result.current.assets).toHaveLength(1);
    });

    it('stays ready while the list grows to a new chain', async () => {
      mockGasMarket.mockImplementation(() => never());
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      const { result } = render();
      await flush();

      await act(async () => {
        setStore({ tokenListMap: { [KEY]: [hoodEth, ethUsdc] } });
      });
      expect(result.current.listReady).toBe(true);
      expect(result.current.assets.map(a => a.chain)).toEqual(['eth', 'hood']);
    });

    it('loads while there is nothing to pay with yet', async () => {
      const { result } = render();
      await flush();
      expect(result.current.listReady).toBe(false);

      await act(async () => {
        setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      });
      expect(result.current.listReady).toBe(true);
    });

    it('stops loading when the refresh fails with no list at all', async () => {
      setStore({ getTokenList: () => Promise.reject(new Error('network')) });
      const { result } = render();
      await flush();
      expect(result.current.listReady).toBe(true);
      expect(result.current.assets).toEqual([]);
    });

    it('stops loading when the refresh ends with nothing to pay with', async () => {
      setStore({ getTokenList: () => Promise.resolve() });
      const { result } = render();
      await flush();
      expect(result.current.listReady).toBe(true);
      expect(result.current.assets).toEqual([]);
    });
  });

  describe('gas', () => {
    it('reserves nothing until the real gas arrives', async () => {
      let releaseGas!: (levels: typeof GAS_LEVELS) => void;
      mockGasMarket.mockImplementation(
        () =>
          new Promise(resolve => {
            releaseGas = resolve;
          }),
      );
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      const { result } = render(1000);
      await flush();
      act(() => result.current.toggle('hood:hood'));
      expect(result.current.plan.spendableTotalUsd).toBeCloseTo(90);

      await act(async () => {
        // 100,000 gas x 1e11 wei = 0.01 native at $1
        releaseGas([{ level: 'normal', price: 1e11 }]);
      });
      await flush();
      expect(result.current.plan.spendableTotalUsd).toBeCloseTo(89.99);
    });

    it('reserves nothing when the gas request fails', async () => {
      mockGasMarket.mockRejectedValue(new Error('network'));
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      const { result } = render(1000);
      await flush();
      act(() => result.current.toggle('hood:hood'));
      expect(result.current.plan.spendableTotalUsd).toBeCloseTo(90);
    });

    it('can plan a cross-chain asset before its gas arrives', async () => {
      mockGasMarket.mockImplementation(() => never());
      setStore({ tokenListMap: { [KEY]: [ethUsdc] } });
      const { result } = render();
      await flush();
      act(() => result.current.toggle('eth:0xusdc'));
      expect(result.current.plan.shortfallUsd).toBe(0);
      expect(result.current.plan.legs.map(l => l.kind)).toEqual(['bridge']);
    });

    it('fetches each chain once as the list grows', async () => {
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      render();
      await flush();
      await act(async () => {
        setStore({ tokenListMap: { [KEY]: [hoodEth, ethUsdc] } });
      });
      await flush();
      expect(mockGasMarket.mock.calls.map(([chain]) => chain)).toEqual([
        'hood',
        'eth',
      ]);
    });
  });

  describe('allocationMode', () => {
    it('plans with the mode it is given', async () => {
      const twoMemes: MemeTarget[] = [
        { id: '0xa', chain: 'hood', symbol: 'A', marketCap: 3 },
        { id: '0xb', chain: 'hood', symbol: 'B', marketCap: 1 },
      ];
      setStore({ tokenListMap: { [KEY]: [hoodEth] } });
      const { result, rerender } = renderHook(
        ({ allocationMode }: { allocationMode: AllocationMode }) =>
          usePaymentAssets({
            account,
            memes: twoMemes,
            memeTokenKeys,
            amountUsd: 40,
            allocationMode,
          }),
        { initialProps: { allocationMode: 'marketCap' as AllocationMode } },
      );
      await flush();
      act(() => result.current.toggle('hood:hood'));
      expect(result.current.plan.legs.map(l => l.amountUsd)).toEqual([30, 10]);

      rerender({ allocationMode: 'equal' });
      expect(result.current.plan.legs.map(l => l.amountUsd)).toEqual([20, 20]);
    });
  });
});
