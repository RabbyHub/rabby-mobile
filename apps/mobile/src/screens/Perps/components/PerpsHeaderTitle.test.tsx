import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { PerpsNativeHeader } from './PerpsHeaderTitle';

const mockSetOptions = jest.fn();

jest.mock('@/assets2024/icons/perps/IconHyper.svg', () => 'MockIconHyper');

jest.mock('@/components/Typography', () => {
  const { Text } = require('react-native');
  return { Text };
});

jest.mock('@/components/Icons/CaretArrowIconCC', () => ({
  CaretArrowIconCC: () => null,
}));

jest.mock('@/components2024/WalletIcon/WalletIcon', () => ({
  WalletIcon: () => null,
}));

jest.mock('@/core/apis', () => ({
  apiContact: {
    getAliasName: jest.fn(),
  },
}));

jest.mock('@/hooks/navigation', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    HeaderBackPressable: () =>
      ReactModule.createElement(View, { testID: 'back-button' }),
    useRabbyAppNavigation: () => ({
      setOptions: mockSetOptions,
    }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    colors2024: {
      'neutral-bg-1': '#fff',
      'neutral-bg-5': '#eee',
      'neutral-title-1': '#000',
    },
    styles: {
      accountName: {},
      accountSelector: {},
      accountSelectorContainer: {},
      headerInner: {},
      headerLeft: {},
      headerOuter: {},
      headerRight: {},
      reverseCaret: {},
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  }),
}));

jest.mock('../hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [{ isShowLoginPopup: false }, jest.fn()],
}));

jest.mock('./PerpHistoryHeader', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpHistoryHeader: () =>
      ReactModule.createElement(View, { testID: 'history-entry' }),
  };
});

jest.mock('../../PerpsShared/components/PerpsModeSwitch', () => {
  const ReactModule = require('react');
  const { Pressable } = require('react-native');
  return {
    PerpsModeSwitch: ({
      activeMode,
      disabled,
      onSelectMode,
    }: {
      activeMode: 'simple' | 'pro';
      disabled?: boolean;
      onSelectMode: (mode: 'simple' | 'pro') => void;
    }) =>
      ReactModule.createElement(Pressable, {
        accessibilityLabel: activeMode,
        accessibilityState: { disabled },
        disabled,
        onPress: () => onSelectMode('pro'),
        testID: 'mode-switch',
      }),
  };
});

describe('PerpsNativeHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('explicitly owns the native header and adds the Pro entry', () => {
    const onSwitchToPro = jest.fn();
    render(
      <PerpsNativeHeader
        account={null}
        isModeSwitching={false}
        localLoadingHistory={[]}
        onSwitchToPro={onSwitchToPro}
      />,
    );

    const options = mockSetOptions.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      headerShown: true,
      headerStyle: {
        backgroundColor: '#fff',
      },
    });

    const header = render(options.header());
    expect(header.getByTestId('back-button')).toBeOnTheScreen();
    expect(header.getByTestId('history-entry')).toBeOnTheScreen();
    expect(header.getByTestId('mode-switch').props.accessibilityLabel).toBe(
      'simple',
    );

    fireEvent.press(header.getByTestId('mode-switch'));
    expect(onSwitchToPro).toHaveBeenCalledTimes(1);
  });
});
