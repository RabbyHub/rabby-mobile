import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { MultiAddressHomeHeader } from './MultiAddressHomeHeader';

// Component contract only. The native Paper/Fabric interop border composition
// still requires visual validation on iOS; the gradient is an external boundary.
let mockIsLight = true;
let mockWalletsPress: () => void;
let mockChartTabName: string;
let mockModalParams: any;
let mockIsFocused = true;
let mockModalSequence = 0;
const mockRemoveModal = jest.fn();
const mockShowAddWallet = jest.fn();
const mockNavigation = { isFocused: () => mockIsFocused };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('react-native-linear-gradient', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
});
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  Easing: { out: (fn: unknown) => fn, cubic: () => undefined },
  FadeInUp: { duration: () => ({ easing: () => undefined }) },
}));
jest.mock('@react-native-community/blur', () => ({
  BlurView: require('react-native').View,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (theme: object) => object }) => {
    const theme = {
      isLight: mockIsLight,
      colors2024: { 'neutral-black': '#000000' },
    };
    return { ...theme, styles: getStyle(theme) };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (fn: unknown) => fn,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/account', () => ({ usePinnedAccountList: () => [] }));
jest.mock('@/hooks/useGlobalStatus', () => ({
  useGlobalStatus: () => ({ isDisConnect: false }),
}));
jest.mock('@/utils/analytics', () => ({ matomoRequestEvent: jest.fn() }));
jest.mock('@/components2024/GlobalWarning/Warining', () => ({
  GlobalWarning: () => null,
}));
jest.mock('../hooks/useHideBalance', () => ({
  useHideBalance: () => ['SHOW'],
}));
jest.mock('./HomeAddressItem', () => ({ HomeAddressItem: () => null }));
jest.mock(
  '@/screens/Address/components/MultiAssets/RenderRow/CurveChart',
  () => ({
    MultiChart: ({ onPressWalletList, tabName }: any) => {
      mockWalletsPress = onPressWalletList;
      mockChartTabName = tabName;
      return null;
    },
    setIsFoldMultiChart: jest.fn(),
  }),
);
jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: (params: any) => {
    mockModalParams = params;
    return `wallets-${++mockModalSequence}`;
  },
  removeGlobalBottomSheetModal2024: (...args: any[]) =>
    mockRemoveModal(...args),
}));
jest.mock('@/components2024/GlobalBottomSheetModal/types', () => ({
  MODAL_NAMES: {},
}));
jest.mock('@/components2024/GlobalBottomSheetModal/apiGlobalModal', () => ({
  apiGlobalModal: { showAddSelectMethodModal: () => mockShowAddWallet() },
}));
jest.mock('@/hooks/navigation', () => ({
  apisHomeTabIndex: {},
  HomeTabName: { overview: 'overview' },
}));
jest.mock('@/store/balance24h', () => ({ balance24hStore: {} }));
jest.mock('@/store/homePortfolio/consistency', () => ({
  buildPortfolioAddressChange: jest.fn(),
}));
jest.mock('@/hooks/storeActivity/useActivityStore', () => ({
  useActivityStore: jest.fn(),
}));

it.each([true, false])(
  'keeps the balance-card border and clipping on one RN view (light=%s)',
  isLight => {
    mockIsLight = isLight;
    render(<MultiAddressHomeHeader />);
    expect(mockChartTabName).toBe('overview');
    const gradient = screen.UNSAFE_getByType(LinearGradient);
    const gradientStyle = StyleSheet.flatten(gradient.props.style);
    expect(gradientStyle.borderWidth).toBeUndefined();
    expect(gradientStyle.borderRadius).toBeUndefined();
    const frames = screen.UNSAFE_getAllByType(View).filter(view => {
      const style = StyleSheet.flatten(view.props.style);
      return style?.borderWidth === 1 && style?.overflow === 'hidden';
    });
    expect(frames).toHaveLength(1);
    expect(StyleSheet.flatten(frames[0].props.style)).toMatchObject({
      borderRadius: 20,
      borderColor: isLight ? 'rgba(255, 255, 255, 1)' : 'rgba(35, 36, 40, 1)',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
    expect(frames[0].findByType(LinearGradient)).toBe(gradient);
  },
);

describe('wallet sheet to add-wallet navigation', () => {
  beforeEach(() => {
    mockIsFocused = true;
    mockRemoveModal.mockClear();
    mockShowAddWallet.mockClear();
  });

  it('waits for native dismissal and consumes repeated add taps once', () => {
    render(<MultiAddressHomeHeader />);
    act(() => mockWalletsPress());
    act(() => {
      mockModalParams.onAddAddressPress();
      mockModalParams.onAddAddressPress();
    });
    expect(mockShowAddWallet).not.toHaveBeenCalled();
    expect(mockRemoveModal).toHaveBeenCalledTimes(1);
    expect(mockRemoveModal).toHaveBeenCalledWith(expect.any(String), {
      waitForDismiss: true,
    });
    act(() => mockModalParams.bottomSheetModalProps.onDismiss());
    expect(mockShowAddWallet).toHaveBeenCalledTimes(1);
    act(() => mockModalParams.bottomSheetModalProps.onDismiss());
    expect(mockShowAddWallet).toHaveBeenCalledTimes(1);
  });

  it.each(['backdrop', 'blur', 'unmount', 'new-sheet'])(
    'does not open add-wallet after %s',
    reason => {
      const view = render(<MultiAddressHomeHeader />);
      act(() => mockWalletsPress());
      const previous = mockModalParams;
      if (reason !== 'backdrop') {
        act(() => previous.onAddAddressPress());
      }
      if (reason === 'blur') mockIsFocused = false;
      if (reason === 'unmount') view.unmount();
      if (reason === 'new-sheet') act(() => mockWalletsPress());
      act(() => previous.bottomSheetModalProps.onDismiss?.());
      expect(mockShowAddWallet).not.toHaveBeenCalled();
    },
  );
});
