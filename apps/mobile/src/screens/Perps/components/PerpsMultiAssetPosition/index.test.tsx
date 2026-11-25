import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import type { Account } from '@/core/startupServices/preference';
import type { AssetPosition } from '@rabby-wallet/hyperliquid-sdk';

const mockAccountListeners = new Set<() => void>();
let mockAccount = {
  address: '0xabc',
  aliasName: 'First wallet',
  brandName: 'watch',
} as Account;
const mockAvatarRender = jest.fn();
const mockOtherAccount = {
  address: '0xdef',
  aliasName: 'Other wallet',
  brandName: 'watch',
} as Account;

jest.mock('@/hooks/perps/usePerpsStore', () => ({
  perpsStore: require('zustand/vanilla').createStore(() => ({
    clearinghouseStateMap: {},
    marketDataMap: {},
  })),
}));
jest.mock('@/screens/Address/components/MultiAssets/hooks/share', () => ({
  useFindAccountByAddress: () => {
    const ReactModule = require('react');
    const account = ReactModule.useSyncExternalStore(
      (listener: () => void) => {
        mockAccountListeners.add(listener);
        return () => mockAccountListeners.delete(listener);
      },
      () => mockAccount,
      () => mockAccount,
    );
    return ReactModule.useCallback(
      (address: string) =>
        address === account.address
          ? account
          : address === mockOtherAccount.address
          ? mockOtherAccount
          : undefined,
      [account],
    );
  },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, isLight: true }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({}),
}));
jest.mock('@/hooks/perps/navigation/navigateToPreferredPerps', () => ({
  navigateToPreferredPerps: jest.fn(),
}));
jest.mock('@/utils/perps', () => ({
  formatPerpsCoin: (coin: string) => coin,
  getFallbackCoinLogoUrl: (coin: string) => `${coin}.png`,
}));
jest.mock('@/utils/number', () => ({
  formatUsdValue: (value: number) => `$${value}`,
}));
jest.mock('@/utils/address', () => ({
  ellipsisAddress: (address: string) => address,
}));
jest.mock('@/constant/perps', () => ({
  PERPS_POSITION_RISK_LEVEL: {
    DANGER: 'danger',
    WARNING: 'warning',
    SAFE: 'safe',
  },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components', () => ({
  AssetAvatar: (props: object) => {
    mockAvatarRender(props);
    return require('react').createElement(require('react-native').View, props);
  },
}));
jest.mock('@/components2024/WalletIcon/WalletIcon', () => ({
  WalletIcon: require('react-native').View,
}));
jest.mock(
  '@/assets2024/icons/perps/IconHyper.svg',
  () => require('react-native').View,
);
jest.mock(
  '@/assets2024/icons/perps/IconAssetArrowCC.svg',
  () => require('react-native').View,
);
jest.mock('react-native-svg', () => ({ SvgUri: require('react-native').View }));
jest.mock('../PerpsPositionSection/DistanceToLiquidationTag', () => ({
  DistanceToLiquidationTag: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'risk-trigger',
    }),
}));
jest.mock('../PerpsPositionSection/PerpsRiskLevelPopup', () => ({
  PerpsRiskLevelPopup: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'risk-popup',
    }),
}));

import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { PerpsMultiAssetPosition } from './index';
import type { HomePerpsPositionSource } from './positionSelector';

function makePosition(): AssetPosition {
  return {
    type: 'oneWay',
    position: {
      coin: 'ETH',
      entryPx: '2000',
      szi: '1',
      positionValue: '2100',
      marginUsed: '500',
      unrealizedPnl: '100',
      liquidationPx: '1500',
      leverage: { type: 'cross', value: 4 },
    },
  } as AssetPosition;
}

function updatePosition(change: Partial<AssetPosition['position']>) {
  act(() => {
    perpsStore.setState(state => ({
      clearinghouseStateMap: {
        ...state.clearinghouseStateMap,
        '0xabc': {
          ...state.clearinghouseStateMap['0xabc']!,
          assetPositions: [
            {
              ...makePosition(),
              position: { ...makePosition().position, ...change },
            },
          ],
        },
      },
    }));
  });
}

// Component contracts with mocked account/service/visual collaborators. The
// selector and useActivityStore are real; provider publication is separately
// covered by positionSelector.integration.test.tsx. No native timing claim.
describe('PerpsMultiAssetPosition metadata subscription', () => {
  beforeEach(() => {
    mockAccount = { ...mockAccount, aliasName: 'First wallet' };
    mockAvatarRender.mockClear();
    perpsStore.setState({
      clearinghouseStateMap: {
        '0xabc': { assetPositions: [makePosition()], time: 1 },
      },
      marketDataMap: {
        ETH: {
          quoteAsset: 'USDC',
          displayName: 'Ether',
          logoUrl: 'eth.png',
          markPx: '2100',
        },
      },
    } as HomePerpsPositionSource);
  });

  it('does not rerender cards for ticker-only changes but applies metadata', () => {
    const view = render(<PerpsMultiAssetPosition />);
    const initialRenders = mockAvatarRender.mock.calls.length;
    expect(view.getByText('Ether')).toBeTruthy();
    act(() => {
      perpsStore.setState(state => ({
        marketDataMap: {
          ...state.marketDataMap,
          ETH: { ...state.marketDataMap.ETH, markPx: '2500' },
          BTC: { ...state.marketDataMap.ETH, markPx: '90000' },
        },
      }));
    });
    expect(mockAvatarRender).toHaveBeenCalledTimes(initialRenders);
    act(() => {
      perpsStore.setState(state => ({
        marketDataMap: {
          ...state.marketDataMap,
          ETH: {
            ...state.marketDataMap.ETH,
            displayName: 'New Ether',
            quoteAsset: 'USDH',
            logoUrl: 'new-eth.png',
          },
        },
      }));
    });
    expect(view.getByText('New Ether')).toBeTruthy();
    expect(view.getByText('/USDH')).toBeTruthy();
    expect(mockAvatarRender).toHaveBeenLastCalledWith({
      logo: 'new-eth.png',
      size: 28,
    });
    act(() => perpsStore.setState({ marketDataMap: {} }));
    expect(view.getByText('ETH')).toBeTruthy();
    expect(view.getByText('/USDC')).toBeTruthy();
    expect(mockAvatarRender).toHaveBeenLastCalledWith({
      logo: 'ETH.png',
      size: 28,
    });
  });

  it('keeps the selected risk popup and account alias live across updates', () => {
    const view = render(<PerpsMultiAssetPosition />);
    fireEvent.press(view.getByTestId('risk-trigger'));
    const popup = view.getByTestId('risk-popup');
    expect(popup.props.currentPrice).toBe(2100);
    expect(popup.props.liquidationPrice).toBe(1500);
    expect(popup.props.isCross).toBe(true);

    act(() => {
      perpsStore.setState(state => ({
        marketDataMap: {
          ...state.marketDataMap,
          ETH: { ...state.marketDataMap.ETH, markPx: '9999' },
        },
      }));
    });
    expect(view.getByTestId('risk-popup')).toBe(popup);
    expect(popup.props.currentPrice).toBe(2100);

    updatePosition({
      positionValue: '2400',
      liquidationPx: '1700',
      leverage: { type: 'isolated', value: 3 },
      unrealizedPnl: '400',
    });
    expect(view.getByTestId('risk-popup')).toBe(popup);
    expect(popup.props.currentPrice).toBe(2400);
    expect(popup.props.liquidationPrice).toBe(1700);
    expect(popup.props.distanceLiquidation).toBeCloseTo(700 / 2400);
    expect(popup.props.isCross).toBe(false);
    expect(view.getByText('Long 3x')).toBeTruthy();
    expect(view.getByText('+$400')).toBeTruthy();

    act(() => {
      mockAccount = { ...mockAccount, aliasName: 'Renamed wallet' };
      [...mockAccountListeners].forEach(listener => listener());
    });
    expect(view.queryByText('First wallet')).toBeNull();
    expect(view.getByText('Renamed wallet')).toBeTruthy();
    expect(view.getByTestId('risk-popup')).toBe(popup);
    expect(popup.props.currentPrice).toBe(2400);

    fireEvent(popup, 'close');
    expect(view.queryByTestId('risk-popup')).toBeNull();
    updatePosition({ positionValue: '2600' });
    expect(view.queryByTestId('risk-popup')).toBeNull();
    fireEvent.press(view.getByTestId('risk-trigger'));
    expect(view.getByTestId('risk-popup').props.currentPrice).toBe(2600);
    view.unmount();
    expect(mockAccountListeners.size).toBe(0);
  });

  it('removes a closed position and its selected risk popup', () => {
    const view = render(<PerpsMultiAssetPosition />);
    fireEvent.press(view.getByTestId('risk-trigger'));
    expect(view.getByTestId('risk-popup')).toBeTruthy();
    act(() => {
      perpsStore.setState(state => ({
        clearinghouseStateMap: {
          '0xabc': {
            ...state.clearinghouseStateMap['0xabc']!,
            assetPositions: [],
          },
        },
      }));
    });
    expect(view.queryByText('Ether')).toBeNull();
    expect(view.queryByTestId('risk-trigger')).toBeNull();
    expect(view.queryByTestId('risk-popup')).toBeNull();
  });

  it('keeps unchanged account rows out of another account position update', () => {
    perpsStore.setState(state => ({
      clearinghouseStateMap: {
        ...state.clearinghouseStateMap,
        '0xdef': {
          ...state.clearinghouseStateMap['0xabc']!,
          assetPositions: [
            {
              ...makePosition(),
              position: { ...makePosition().position, coin: 'BTC' },
            },
          ],
        },
      },
    }));
    const view = render(<PerpsMultiAssetPosition />);
    const avatarRenders = (logo: string) =>
      mockAvatarRender.mock.calls.filter(([props]) => props.logo === logo)
        .length;
    const ethRenders = avatarRenders('eth.png');
    const btcRenders = avatarRenders('BTC.png');

    updatePosition({ unrealizedPnl: '700', positionValue: '2700' });
    expect(view.getByText('+$700')).toBeTruthy();
    expect(avatarRenders('eth.png')).toBe(ethRenders + 1);
    expect(avatarRenders('BTC.png')).toBe(btcRenders);

    fireEvent.press(view.getAllByTestId('risk-trigger')[0]);
    expect(view.getByTestId('risk-popup').props.currentPrice).toBe(2700);
    expect(avatarRenders('eth.png')).toBe(ethRenders + 1);
    expect(avatarRenders('BTC.png')).toBe(btcRenders);
  });
});
