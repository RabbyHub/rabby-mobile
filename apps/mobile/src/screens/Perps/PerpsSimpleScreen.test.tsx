import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ScrollView } from 'react-native';
import type { Account } from '@/core/startupServices/preference';
import { checkPerpsReference } from '@/utils/perps';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { PERPS_HEADER_HEIGHT } from '../PerpsShared/constants';

import { PerpsSimpleScreen } from './PerpsSimpleScreen';

let mockHasPermission = true;
let mockIsLight = true;
let mockIsFocused = true;
let mockIsInitialized = false;
let mockCurrentAccount: Account | null = null;
const mockUsePerpsState = jest.fn();
const mockLimitOrdersSection = jest.fn();

jest.mock('@/constant', () => ({ APP_VERSIONS: { fromNative: 'test' } }));

jest.mock('@/components2024/ScreenContainer/NormalScreenContainer', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({
    children,
    bgImageHeight,
    bgImageSource,
    noHeader,
    type,
  }: {
    children: React.ReactNode;
    bgImageHeight?: number;
    bgImageSource?: object;
    noHeader?: boolean;
    type?: string;
  }) =>
    ReactModule.createElement(
      View,
      {
        accessibilityLabel: `${String(noHeader)}:${String(type)}`,
        bgImageHeight,
        bgImageSource,
        testID: 'screen-container',
      },
      children,
    );
});

jest.mock('@/components2024/Button', () => ({ Button: () => null }));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    colors2024: {},
    isLight: mockIsLight,
    styles: {
      container: {},
      emptyPadding: {},
      footer: {},
      footerBtnItem: {},
      footerBtns: {},
      longBtn: {},
      openPositionBtn: {},
      screenContainer: {},
      scrollContent: {},
      shortBtn: {},
    },
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({}),
}));

jest.mock('@/hooks/perps/usePerpsState', () => ({
  usePerpsState: (options: unknown) => {
    mockUsePerpsState(options);
    return {
      currentPerpsAccount: mockCurrentAccount,
      fetchMarketData: jest.fn(),
      handleActionApproveStatus: jest.fn(),
      handleDeleteAgent: jest.fn(),
      handleSafeSetReference: jest.fn(),
      handleWithdraw: jest.fn(),
      hasPermission: mockHasPermission,
      isInitialized: mockIsInitialized,
      isLogin: false,
      login: jest.fn(),
      logout: jest.fn(),
      perpFee: null,
      positionAndOpenOrders: [],
      refreshData: jest.fn(),
      setInitialized: jest.fn(),
      userFills: [],
    };
  },
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const state = {
    currentClearinghouseState: null,
    isMarketTickerReady: false,
    isUserDataReady: false,
    marketData: [],
    marketDataMap: {},
  };
  return { perpsStore: require('zustand').create(() => state) };
});

jest.mock('@/core/utils/startupDiagnostics', () => ({
  traceStartupDiagnostic: jest.fn(),
}));

jest.mock('@/utils/perps', () => ({
  checkPerpsReference: jest.fn(),
  getStatsReportSide: jest.fn(),
}));

jest.mock('@/utils/navigation', () => ({ naviPush: jest.fn() }));

jest.mock('@/utils/stats', () => ({ stats: { report: jest.fn() } }));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: { setInviteConfig: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock('./components/PerpsHeaderTitle', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsSimpleHeader: () =>
      ReactModule.createElement(View, { testID: 'simple-page-header' }),
  };
});

jest.mock('./components/PerpsSkeletonLoader', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsSkeletonLoader: () =>
      ReactModule.createElement(View, { testID: 'simple-content' }),
  };
});

jest.mock('./components/PerpsPopupGroup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsPopupGroup: () =>
      ReactModule.createElement(View, { testID: 'simple-popup-group' }),
  };
});

jest.mock('./components/PerpsAccountCard', () => ({
  PerpsAccountCard: () => null,
}));
jest.mock('./components/PerpsMarketSection/PerpsMarketHomeList', () => ({
  PerpsMarketHomeList: () => null,
}));
jest.mock('./components/PerpsPositionSection', () => ({
  PerpsPositionSection: () => null,
}));
jest.mock('./components/PerpsLimitOrdersSection', () => ({
  PerpsLimitOrdersSection: (props: unknown) => {
    mockLimitOrdersSection(props);
    return null;
  },
}));
jest.mock('./components/PerpsRegionAlert', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PERPS_REGION_ALERT_HEADER_SPACING: 8,
    PerpsRegionAlert: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'perps-region-alert',
      }),
  };
});

jest.mock('./hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{}, jest.fn()],
}));
jest.mock('./hooks/usePerpsDeposit', () => ({
  usePerpsDeposit: () => ({ handleDeposit: jest.fn() }),
}));
jest.mock('../PerpsMarketDetail/hooks/usePerpsPosition', () => ({
  usePerpsPosition: () => ({
    handleCloseAllPositions: jest.fn(),
    handleStableCoinOrder: jest.fn(),
  }),
}));

describe('PerpsSimpleScreen', () => {
  beforeEach(() => {
    mockHasPermission = true;
    mockIsLight = true;
    mockIsFocused = true;
    mockIsInitialized = false;
    mockCurrentAccount = null;
    jest.clearAllMocks();
    jest.mocked(checkPerpsReference).mockResolvedValue(false);
  });

  it('owns Safe Area directly and places the shared page header before content', () => {
    const screen = render(
      <PerpsSimpleScreen isModeSwitching={false} onSwitchToPro={jest.fn()} />,
    );

    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg0');
    expect(
      screen.getByTestId('screen-container').props.bgImageSource,
    ).toBeUndefined();
    expect(screen.getByTestId('simple-page-header')).toBeOnTheScreen();
    expect(screen.getByTestId('simple-content')).toBeOnTheScreen();
    expect(screen.getByTestId('simple-popup-group')).toBeOnTheScreen();
  });

  it('keeps the dark page on a plain bg1 with no background image', () => {
    mockIsLight = false;

    const screen = render(
      <PerpsSimpleScreen isModeSwitching={false} onSwitchToPro={jest.fn()} />,
    );

    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg1');
    expect(
      screen.getByTestId('screen-container').props.bgImageSource,
    ).toBeUndefined();
    expect(
      screen.getByTestId('screen-container').props.bgImageHeight,
    ).toBeUndefined();
  });

  it('reserves the same header height without duplicating the Root header', () => {
    const screen = render(
      <PerpsSimpleScreen
        sharedHeader
        isModeSwitching={false}
        onSwitchToPro={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('simple-page-header')).toBeNull();
    const placeholder = screen.getByTestId(
      'perps-simple-shared-header-placeholder',
    );
    expect(placeholder).toHaveStyle({ height: PERPS_HEADER_HEIGHT });
    expect(placeholder.props.pointerEvents).toBe('none');
    expect(screen.getByTestId('simple-content')).toBeOnTheScreen();
  });

  it('forwards the restricted alert layout without adding page state', () => {
    mockHasPermission = false;
    const onRegionAlertLayout = jest.fn();
    const screen = render(
      <PerpsSimpleScreen
        isModeSwitching={false}
        onRegionAlertLayout={onRegionAlertLayout}
        onSwitchToPro={jest.fn()}
      />,
    );
    const event = {
      nativeEvent: { layout: { height: 52, width: 361, x: 16, y: 56 } },
    };

    fireEvent(screen.getByTestId('perps-region-alert'), 'layout', event);

    expect(onRegionAlertLayout).toHaveBeenCalledWith(event);
    expect(screen.getByTestId('perps-region-alert').props.topSpacing).toBe(8);
  });

  it('retains the native list but does not host shared popups or check invitations in a preview', async () => {
    mockIsInitialized = true;
    mockCurrentAccount = {
      address: '0x123',
      type: 'Simple Key Pair',
    } as Account;
    const props = { isModeSwitching: false, onSwitchToPro: jest.fn() };
    const screen = render(<PerpsSimpleScreen {...props} sceneActive={false} />);
    const scrollView = screen.UNSAFE_getByType(ScrollView);

    expect(screen.queryByTestId('simple-popup-group')).toBeNull();
    expect(checkPerpsReference).not.toHaveBeenCalled();
    expect(mockLimitOrdersSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ sceneActive: false }),
    );
    expect(mockUsePerpsState).toHaveBeenLastCalledWith({
      legacyRuntimeContinuationEnabled: false,
      pauseInactivePublication: true,
    });

    screen.rerender(<PerpsSimpleScreen {...props} sceneActive />);
    await waitFor(() => expect(checkPerpsReference).toHaveBeenCalledTimes(1));
    expect(screen.UNSAFE_getByType(ScrollView)).toBe(scrollView);
    expect(screen.getByTestId('simple-popup-group')).toBeOnTheScreen();
    expect(mockLimitOrdersSection).toHaveBeenLastCalledWith(
      expect.objectContaining({ sceneActive: true }),
    );
    expect(mockUsePerpsState).toHaveBeenLastCalledWith({
      legacyRuntimeContinuationEnabled: true,
      pauseInactivePublication: true,
    });

    screen.rerender(<PerpsSimpleScreen {...props} sceneActive={false} />);
    expect(screen.UNSAFE_getByType(ScrollView)).toBe(scrollView);
    expect(screen.queryByTestId('simple-popup-group')).toBeNull();
  });

  it('cancels a pending invitation when hidden and checks again on activation', async () => {
    mockCurrentAccount = {
      address: '0x123',
      type: 'Simple Key Pair',
    } as Account;
    let resolveInvite!: (value: boolean) => void;
    jest.mocked(checkPerpsReference).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveInvite = resolve;
        }),
    );
    const props = { isModeSwitching: false, onSwitchToPro: jest.fn() };
    const screen = render(<PerpsSimpleScreen {...props} />);
    await waitFor(() => expect(checkPerpsReference).toHaveBeenCalledTimes(1));

    screen.rerender(<PerpsSimpleScreen {...props} sceneActive={false} />);
    await act(async () => resolveInvite(true));
    expect(perpsServiceApi.setInviteConfig).not.toHaveBeenCalled();
    expect(screen.queryByTestId('simple-popup-group')).toBeNull();

    jest.mocked(checkPerpsReference).mockResolvedValueOnce(true);
    screen.rerender(<PerpsSimpleScreen {...props} sceneActive />);
    await waitFor(() =>
      expect(perpsServiceApi.setInviteConfig).toHaveBeenCalledWith(
        mockCurrentAccount?.address,
        { lastInvitedAt: expect.any(Number) },
      ),
    );
  });

  it('keeps route blur inactive even when Simple is the selected mode', () => {
    mockIsFocused = false;
    mockCurrentAccount = {
      address: '0x123',
      type: 'Simple Key Pair',
    } as Account;
    const screen = render(
      <PerpsSimpleScreen isModeSwitching={false} onSwitchToPro={jest.fn()} />,
    );
    expect(screen.queryByTestId('simple-popup-group')).toBeNull();
    expect(checkPerpsReference).not.toHaveBeenCalled();
    expect(mockUsePerpsState).toHaveBeenLastCalledWith({
      legacyRuntimeContinuationEnabled: false,
      pauseInactivePublication: true,
    });
  });
});
