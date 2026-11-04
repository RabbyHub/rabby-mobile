import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import useTokenList from '@/store/tokens';
import { pushMemeCoinExecute } from '../navigation';
import { allocationModeStore } from '../ui/allocationModeStore';
import { MemeCoinBuyScreen } from './MemeCoinBuyScreen';

const mockGasMarket = jest.fn();

jest.mock('@/core/storage/mmkv', () => ({
  zustandByMMKV: (_key: string, initialState: object) => {
    const { create } = jest.requireActual(
      'zustand',
    ) as typeof import('zustand');
    return create(() => initialState);
  },
}));

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

jest.mock('../navigation', () => ({ pushMemeCoinExecute: jest.fn() }));
jest.mock('../ui/useMemeCoinAccount', () => ({
  useMemeCoinAccount: (address: string) => ({ address }),
}));
jest.mock('../data/memeHoldingsStore', () => ({
  useMemeHoldings: () => ({ holdings: [] }),
}));
jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  const params = {
    accountAddress: '0xAbC',
    amountUsd: 100,
    memes: [
      { id: '0xa', chain: 'hood', symbol: 'AAA', marketCap: 75, logoUrl: '' },
      { id: '0xb', chain: 'hood', symbol: 'BBB', marketCap: 25, logoUrl: '' },
    ],
  };
  return {
    useRoute: () => ({ params }),
    useNavigation: () => ({ goBack: jest.fn() }),
    useFocusEffect: (fn: () => void) => useEffect(fn, [fn]),
  };
});

jest.mock('./PaymentTokenSelectSheet', () => {
  const { createElement } = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  const { tokenKey } = jest.requireActual('../engine/keys');
  return {
    PaymentTokenSelectSheet: ({
      visible,
      assets,
      onToggle,
      onClose,
    }: {
      visible: boolean;
      assets: Array<{ id: string; chain: string; symbol: string }>;
      onToggle: (key: string) => void;
      onClose: () => void;
    }) =>
      createElement(
        View,
        null,
        createElement(Text, null, `sheet:${visible ? 'visible' : 'hidden'}`),
        ...assets.map(asset =>
          createElement(
            Pressable,
            {
              key: tokenKey(asset),
              onPress: () => onToggle(tokenKey(asset)),
            },
            createElement(Text, null, `pick:${asset.symbol}`),
          ),
        ),
        createElement(
          Pressable,
          { onPress: onClose },
          createElement(Text, null, 'close-sheet'),
        ),
      ),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {}, isLight: true }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { amount?: string }) =>
      options?.amount ? `${key}:${options.amount}` : key,
  }),
}));
jest.mock('@/components/Typography', () => ({
  Text: jest.requireActual('react-native').Text,
  TextInput: jest.requireActual('react-native').TextInput,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (usd: number) => `$${usd.toFixed(2)}`,
}));
jest.mock('@/components2024/Button', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress?: () => void;
      disabled?: boolean;
    }) =>
      createElement(
        TouchableOpacity,
        { onPress, disabled },
        createElement(Text, null, title),
      ),
  };
});
jest.mock('@/constant/layout', () => ({
  BOTTOM_BUTTON_SINGLE_HEIGHT: 52,
  BOTTOM_BUTTON_TITLE_STYLE: {},
  BOTTOM_BUTTON_TOP_OFFSET: 12,
  getBottomButtonBottomOffset: () => 36,
}));
jest.mock('@/hooks/useAppLayout', () => ({
  useSafeSizes: () => ({ safeOffBottom: 0, safeOffHeader: 0 }),
}));
jest.mock('../components/MaxPriceImpactSelector', () => ({
  MaxPriceImpactSelector: () => null,
}));
jest.mock('../components/DashedDivider', () => ({ DashedDivider: () => null }));
jest.mock('@/components/AssetAvatar', () => ({ AssetAvatar: () => null }));
jest.mock('@/assets2024/memecoin/pencil-cc.svg', () => () => null);
jest.mock('@/assets2024/memecoin/switch-cc.svg', () => () => null);
jest.mock('@/assets2024/memecoin/empty-payment-light.svg', () => () => null);
jest.mock('@/assets2024/memecoin/empty-payment-dark.svg', () => () => null);

const ADDRESS = '0xAbC';
const hoodEth = {
  id: 'hood',
  chain: 'hood',
  symbol: 'ETH',
  price: 1,
  usd_value: 500,
};

const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const legAmounts = () => {
  const call = (pushMemeCoinExecute as jest.Mock).mock.calls.at(-1)?.[0];
  return call.legs.map((leg: { amountUsd: number }) => leg.amountUsd);
};

describe('MemeCoinBuyScreen allocation wiring', () => {
  let backHandlers: Array<() => boolean>;

  beforeEach(() => {
    (pushMemeCoinExecute as jest.Mock).mockClear();
    allocationModeStore.setState({ mode: 'marketCap' });
    mockGasMarket.mockReset();
    mockGasMarket.mockResolvedValue([{ level: 'normal', price: 1 }]);
    (useTokenList as unknown as { setState(s: unknown): void }).setState({
      tokenListMap: { [ADDRESS.toLowerCase()]: [hoodEth] },
      getTokenList: () => new Promise(() => undefined),
    });
    backHandlers = [];
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, handler) => {
        backHandlers.push(handler as () => boolean);
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('splits the legs by market cap by default', async () => {
    const screen = render(<MemeCoinBuyScreen />);
    await flush();
    fireEvent.press(screen.getByText('pick:ETH'));
    await flush();
    fireEvent.press(screen.getByText('page.memeCoin.buy.preview'));

    expect(pushMemeCoinExecute).toHaveBeenCalledTimes(1);
    expect(legAmounts()).toEqual([75, 25]);
  });

  it('splits the legs equally after switching the mode', async () => {
    const screen = render(<MemeCoinBuyScreen />);
    await flush();
    fireEvent.press(screen.getByText('pick:ETH'));
    await flush();
    fireEvent.press(screen.getByText('page.memeCoin.buy.byMarketCap'));
    await flush();
    screen.getByText('page.memeCoin.buy.equalSplit');
    fireEvent.press(screen.getByText('page.memeCoin.buy.preview'));

    expect(legAmounts()).toEqual([50, 50]);
  });

  it('keeps the switched mode on the next entry', async () => {
    const first = render(<MemeCoinBuyScreen />);
    await flush();
    fireEvent.press(first.getByText('page.memeCoin.buy.byMarketCap'));
    await flush();
    first.unmount();

    const second = render(<MemeCoinBuyScreen />);
    await flush();
    second.getByText('page.memeCoin.buy.equalSplit');
    fireEvent.press(second.getByText('pick:ETH'));
    await flush();
    fireEvent.press(second.getByText('page.memeCoin.buy.preview'));

    expect(legAmounts()).toEqual([50, 50]);
  });

  it('closes the open sheet on Android back before letting it through', async () => {
    const screen = render(<MemeCoinBuyScreen />);
    await flush();
    screen.getByText('sheet:visible');

    const handler = backHandlers[backHandlers.length - 1];
    let handled = false;
    act(() => {
      handled = handler();
    });
    expect(handled).toBe(true);
    screen.getByText('sheet:hidden');

    const next = backHandlers[backHandlers.length - 1];
    expect(next()).toBe(false);
  });
});
