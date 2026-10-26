import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { BackHandler, Platform } from 'react-native';

const mockHideFeeTipsPopup = jest.fn();
const mockRemoveBackHandler = jest.fn();
let mockBackHandler: (() => boolean) | null = null;
let mockIsFeeTipsPopupVisible = false;

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (effect: () => void | (() => void)) =>
      ReactModule.useEffect(effect, [effect]),
    useIsFocused: () => true,
    useRoute: () => ({ params: { initialTab: 'trade' } }),
  };
});

jest.mock(
  '@/components2024/ScreenContainer/NormalScreenContainer',
  () => require('react-native').View,
);
jest.mock('@/hooks/perps/runtime/useEnsurePerpsRuntime', () => ({
  useEnsurePerpsRuntime: jest.fn(),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => ({
    styles: getStyle({}),
  }),
}));
jest.mock('@/hooks/useTipsPopup', () => ({
  useHideTipsPopup: () => mockHideFeeTipsPopup,
  useIsTipsPopupVisible: () => mockIsFeeTipsPopupVisible,
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('../PerpsPro/scene/usePerpsProTradePreferences', () => ({
  usePerpsProTradeAmountUnit: () => 'quote',
}));
jest.mock('./components/PerpsProHistoryPager', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProHistoryPager: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'perps-pro-history-pager',
      }),
  };
});
jest.mock('./scene/usePerpsProHistoryController', () => ({
  usePerpsProHistoryController: () => ({
    activeTab: 'trade',
    loadEarlier: jest.fn(),
    refresh: jest.fn(),
    setActiveTab: jest.fn(),
    state: {},
  }),
}));

import { PerpsProHistoryScreen } from './index';

describe('PerpsProHistoryScreen Android back handling', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(Platform, 'OS');

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
  });

  afterAll(() => {
    if (originalPlatform) {
      Object.defineProperty(Platform, 'OS', originalPlatform);
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandler = null;
    mockIsFeeTipsPopupVisible = false;
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName, handler) => {
        mockBackHandler = handler;
        return { remove: mockRemoveBackHandler };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not intercept Back when the owned Fee Popup is closed', () => {
    render(<PerpsProHistoryScreen />);

    expect(screen.getByTestId('perps-pro-history-pager')).toBeOnTheScreen();
    expect(BackHandler.addEventListener).not.toHaveBeenCalled();
  });

  it('consumes the first Back event to close only the owned Fee Popup', () => {
    mockIsFeeTipsPopupVisible = true;
    const view = render(<PerpsProHistoryScreen />);

    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
    let handled = false;
    act(() => {
      handled = mockBackHandler?.() ?? false;
    });

    expect(handled).toBe(true);
    expect(mockHideFeeTipsPopup).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('perps-pro-history-pager')).toBeOnTheScreen();

    mockIsFeeTipsPopupVisible = false;
    view.rerender(<PerpsProHistoryScreen />);
    expect(mockRemoveBackHandler).toHaveBeenCalledTimes(1);
  });
});
