import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { Provider } from 'jotai';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { Account } from '@/core/startupServices/preference';
import { useTokenPair } from '../Swap/hooks/token';
import { useBridge } from '../Bridge/hooks/token';
import { isSwapBridgeSceneActive } from './sceneActivation';
import { swapFormStore } from './state/swapFormStores';
import { bridgeAmountStore } from '../Bridge/state/bridgeAmountStores';

const mockAccount = { address: '0x123' } as Account;
const mockFromToken = {
  id: 'eth',
  chain: 'eth',
  symbol: 'ETH',
  decimals: 18,
  amount: 100,
  raw_amount_hex_str: '0x56bc75e2d63100000',
  price: 2000,
} as TokenItem;
const mockToToken = { ...mockFromToken, id: 'usdc', symbol: 'USDC', price: 1 };
const mockBridgeToToken = { ...mockToToken, chain: 'arb' };
const mockSwapService = {
  getSelectedChain: () => CHAINS_ENUM.ETH,
  getSelectedFromToken: () => mockFromToken,
  getSelectedToToken: () => mockToToken,
  setSelectedFromToken: jest.fn(),
  setSelectedToToken: jest.fn(),
};

// Hook unit tests: keep form state, async cancellation and debounce real;
// isolate service/settings dependencies and network work, not native gestures.
jest.mock('../Swap/swapServiceDependencies', () => ({
  useSwapService: () => mockSwapService,
}));
jest.mock('@/core/request', () => ({
  openapi: {
    getToken: jest.fn(async (_address, chain, id) =>
      chain === 'arb'
        ? mockBridgeToToken
        : id === 'eth'
        ? mockFromToken
        : mockToToken,
    ),
    isSameBridgeToken: jest.fn(async () => []),
  },
}));
jest.mock('@/core/apis', () => ({
  apiProvider: {
    gasMarketV2: jest.fn(async () => [{ level: 'normal', price: 1e9 }]),
  },
}));
jest.mock('@/core/apis/transactions', () => ({
  getGasTokenBalance: jest.fn(),
}));
jest.mock('@/hooks/accountsSwitcher', () => ({
  useSceneAccountInfo: () => ({ finalSceneCurrentAccount: mockAccount }),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useRoute: () => ({
    params: { chainEnum: 'ETH', toChainEnum: 'ARBITRUM', toTokenId: 'usdc' },
  }),
}));
jest.mock('@/hooks/accountChainBalance', () => {
  const fetchOrderedChainList = jest.fn();
  return { useLoadMatteredChainBalances: () => ({ fetchOrderedChainList }) };
});
jest.mock('@/hooks/useChain', () => ({
  useAsyncInitializeChainList: jest.fn(),
}));
jest.mock('@/hooks/miniSignGasStore', () => ({
  useClearMiniGasStateEffect: jest.fn(),
}));
jest.mock('../Swap/hooks/autoSlippageEffect', () => ({
  useAutoSlippageEffect: jest.fn(),
}));
jest.mock('../Swap/hooks/slippage', () => {
  const setSlippage = jest.fn();
  return {
    useSlippageStore: () => ({
      slippage: '1',
      autoSlippage: false,
      setSlippage,
    }),
    getSwapAutoSlippageValue: () => '1',
  };
});
jest.mock('../Swap/hooks/settings', () => {
  const setSwapSortIncludeGasFee = jest.fn();
  return { useSwapSettings: () => ({ setSwapSortIncludeGasFee }) };
});
jest.mock('../Swap/components/LowCreditModal', () => ({
  useLowCreditState: () => ({}),
}));
jest.mock('../Swap/hooks/quote', () => {
  const methods = {
    getAllQuotes: jest.fn(async () => []),
    validSlippage: jest.fn(async () => ({ is_valid: true })),
  };
  return { useQuoteMethods: () => methods };
});
jest.mock('../Bridge/hooks/atom', () => {
  const chains = ['ETH', 'ARBITRUM'];
  const aggregators = [];
  return {
    useBridgeSupportedChains: () => chains,
    useAggregatorsList: () => aggregators,
  };
});
jest.mock('../Bridge/utils/bridgeApproval', () => ({
  getBridgeQuoteApproval: jest.fn(),
}));
jest.mock('@rabby-wallet/rabby-bridge', () => ({
  getQuoteList: jest.fn(async () => []),
}));
jest.mock('@rabby-wallet/rabby-swap', () => ({
  WrapTokenAddressMap: {},
  isSwapWrapToken: () => false,
  isStableTokenPair: () => false,
  isNativeAndDerivativeTokenPair: () => false,
}));
jest.mock('@/constant/swap', () => ({
  SWAP_SUPPORT_CHAINS: ['ETH'],
  getChainDefaultToken: chain =>
    chain === 'ARBITRUM' ? mockBridgeToToken : mockFromToken,
  getDefaultSwapToTokenItem: () => mockToToken,
}));
jest.mock('@/utils/chain', () => {
  const { CHAINS: chains } = require('@debank/common');
  return {
    findChainByEnum: chain => chains[chain],
    findChainByServerID: id =>
      Object.values(chains).find((chain: any) => chain.serverId === id),
    findChain: ({ enum: chain }) => chains[chain],
  };
});
jest.mock('@/utils/token', () => ({
  getTokenSymbol: token => token.symbol,
  isTokenMarketClosed: () => false,
}));
jest.mock('@/utils/tempo', () => ({
  isTempoChain: () => false,
  convert18RawToTokenRaw: value => value,
}));
jest.mock('@/utils/number', () => ({
  formatTokenAmountInput: value => value,
  formatUsdValue: String,
}));
jest.mock('@/screens/GasAccount/utils/depositFlowRuntime', () => ({
  isGasAccountDepositFlowActive: () => false,
}));

function Wrapper({ children }: React.PropsWithChildren) {
  return <Provider>{children}</Provider>;
}

type SceneProps = { activeTab: 'swap' | 'bridge'; focused: boolean };

beforeEach(() => {
  jest.useFakeTimers();
  // The amount stores are scene singletons; start every case from a clean form.
  swapFormStore.getState().actions.resetAmount();
  bridgeAmountStore.getState().actions.resetAmount();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

async function settle() {
  await act(async () => {});
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
}

describe('Swap tab form reset', () => {
  function setup() {
    return renderHook(
      ({ activeTab, focused }: SceneProps) =>
        useTokenPair({
          account: mockAccount,
          active: isSwapBridgeSceneActive({
            activeTab,
            scene: 'swap',
            screenFocused: focused,
          }),
          tabSelected: activeTab === 'swap',
        }),
      { initialProps: { activeTab: 'swap', focused: true }, wrapper: Wrapper },
    );
  }

  it('clears the form and quote UI on tab switch, preserving the pair', async () => {
    const { result, rerender } = setup();
    await settle();
    act(() => {
      swapFormStore.getState().actions.endSlider({
        draft: '1',
        isMax: true,
        passGasPrice: true,
      });
      result.current.openQuotesList();
      result.current.setActiveProvider({ name: 'test' } as never);
    });
    expect(result.current.payAmount).not.toBe('');
    expect(result.current.passGasPrice).toBe(true);
    expect(result.current.quotesListVisible).toBe(true);

    rerender({ activeTab: 'bridge', focused: true });
    expect(result.current).toMatchObject({
      payAmount: '',
      passGasPrice: false,
      quotesListVisible: false,
      currentProvider: undefined,
    });
    expect(result.current.quoteList ?? []).toHaveLength(0);
    expect(swapFormStore.getState()).toMatchObject({
      draft: '',
      committed: '',
      isDragging: false,
      isMax: false,
      pendingSlider: null,
    });
    rerender({ activeTab: 'swap', focused: true });
    await settle();
    expect(result.current.payAmount).toBe('');
    expect(result.current.payToken?.id).toBe(mockFromToken.id);
    expect(result.current.receiveToken?.id).toBe(mockToToken.id);
    expect(result.current.chain).toBe(CHAINS_ENUM.ETH);
  });

  it('preserves amount when returning from another screen', async () => {
    const { result, rerender } = setup();
    await settle();
    act(() =>
      swapFormStore.getState().actions.endSlider({
        draft: '0.37',
        isMax: false,
      }),
    );
    const amount = result.current.payAmount;
    expect(Number(amount)).toBeGreaterThan(0);
    rerender({ activeTab: 'swap', focused: false });
    expect(result.current.payAmount).toBe(amount);
    expect(swapFormStore.getState().draft).toBe('0.37');
    rerender({ activeTab: 'swap', focused: true });
    await settle();
    expect(result.current.payAmount).toBe(amount);
  });
});

describe('Bridge tab form reset', () => {
  function setup() {
    return renderHook(
      ({ activeTab, focused }: SceneProps) =>
        useBridge(false, {
          active: isSwapBridgeSceneActive({
            activeTab,
            scene: 'bridge',
            screenFocused: focused,
          }),
          tabSelected: activeTab === 'bridge',
        }),
      {
        initialProps: { activeTab: 'bridge', focused: true },
        wrapper: Wrapper,
      },
    );
  }

  it('clears the form and quotes on tab switch, preserving the pair', async () => {
    const { result, rerender } = setup();
    await settle();
    act(() => {
      bridgeAmountStore.getState().actions.endSlider({
        draft: '1',
        isMax: true,
        passGasPrice: true,
      });
      result.current.setSelectedBridgeQuote({ bridge_id: 'test' } as never);
    });
    expect(result.current.amount).not.toBe('');
    expect(result.current.passGasPrice).toBe(true);
    result.current.isMaxRef.current = true;

    rerender({ activeTab: 'swap', focused: true });
    expect(result.current).toMatchObject({
      amount: '',
      passGasPrice: false,
    });
    expect(result.current.isMaxRef.current).toBe(false);
    expect(bridgeAmountStore.getState()).toMatchObject({
      draft: '',
      committed: '',
      isDragging: false,
      isMax: false,
      pendingSlider: null,
    });
    rerender({ activeTab: 'bridge', focused: true });
    await settle();
    expect(result.current.amount).toBe('');
    expect(result.current.fromToken?.id).toBe(mockFromToken.id);
    expect(result.current.toToken?.id).toBe(mockBridgeToToken.id);
    expect(result.current.fromChain).toBe(CHAINS_ENUM.ETH);
    expect(result.current.toChain).toBe(CHAINS[CHAINS_ENUM.ARBITRUM].enum);
  });

  it('preserves amount when returning from another screen', async () => {
    const { result, rerender } = setup();
    await settle();
    act(() =>
      bridgeAmountStore.getState().actions.endSlider({
        draft: '0.37',
        isMax: false,
      }),
    );
    const amount = result.current.amount;
    expect(Number(amount)).toBeGreaterThan(0);
    rerender({ activeTab: 'bridge', focused: false });
    expect(result.current.amount).toBe(amount);
    expect(bridgeAmountStore.getState().draft).toBe('0.37');
    rerender({ activeTab: 'bridge', focused: true });
    await settle();
    expect(result.current.amount).toBe(amount);
  });
});
