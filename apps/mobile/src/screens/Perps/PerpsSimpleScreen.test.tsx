import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsSimpleScreen } from './PerpsSimpleScreen';

let mockHasPermission = true;

jest.mock('@/constant', () => ({ APP_VERSIONS: { fromNative: 'test' } }));

jest.mock('@/components2024/ScreenContainer/NormalScreenContainer', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({
    children,
    noHeader,
    type,
  }: {
    children: React.ReactNode;
    noHeader?: boolean;
    type?: string;
  }) =>
    ReactModule.createElement(
      View,
      {
        accessibilityLabel: `${String(noHeader)}:${String(type)}`,
        testID: 'screen-container',
      },
      children,
    );
});

jest.mock('@/components2024/Button', () => ({ Button: () => null }));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    colors2024: {},
    isLight: true,
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
      topBg: {},
    },
  }),
}));

jest.mock('@/hooks/navigation', () => ({
  useRabbyAppNavigation: () => ({}),
}));

jest.mock('@/hooks/perps/usePerpsState', () => ({
  usePerpsState: () => ({
    currentPerpsAccount: null,
    fetchMarketData: jest.fn(),
    handleActionApproveStatus: jest.fn(),
    handleDeleteAgent: jest.fn(),
    handleSafeSetReference: jest.fn(),
    handleWithdraw: jest.fn(),
    hasPermission: mockHasPermission,
    isInitialized: false,
    isLogin: false,
    login: jest.fn(),
    logout: jest.fn(),
    perpFee: null,
    positionAndOpenOrders: [],
    refreshData: jest.fn(),
    setInitialized: jest.fn(),
    userFills: [],
  }),
}));

jest.mock('@/hooks/perps/usePerpsStore', () => {
  const state = {
    currentClearinghouseState: null,
    isMarketTickerReady: false,
    isUserDataReady: false,
    marketData: [],
    marketDataMap: {},
  };
  const perpsStore = (selector: (value: typeof state) => unknown) =>
    selector(state);
  perpsStore.getState = () => state;
  return { perpsStore };
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

jest.mock('ahooks', () => ({
  useMemoizedFn: (fn: unknown) => fn,
  useRequest: () => ({ data: false, mutate: jest.fn() }),
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
  PerpsLimitOrdersSection: () => null,
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
  });

  it('owns Safe Area directly and places the shared page header before content', () => {
    const screen = render(
      <PerpsSimpleScreen isModeSwitching={false} onSwitchToPro={jest.fn()} />,
    );

    expect(
      screen.getByTestId('screen-container').props.accessibilityLabel,
    ).toBe('true:bg0');
    expect(screen.getByTestId('simple-page-header')).toBeOnTheScreen();
    expect(screen.getByTestId('simple-content')).toBeOnTheScreen();
    expect(screen.getByTestId('simple-popup-group')).toBeOnTheScreen();
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
});
