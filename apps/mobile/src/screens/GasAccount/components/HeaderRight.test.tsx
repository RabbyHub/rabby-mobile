import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TouchableOpacity as RNGHTouchableOpacity } from 'react-native-gesture-handler';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { GasAccountHeader } from './HeaderRight';

// Keep CustomTouchableOpacity and RNGH's TouchableOpacity real. Only the
// native bridge is replaced: this guards host selection, not device hit tests.
jest.mock(
  'react-native-gesture-handler/lib/commonjs/RNGestureHandlerModule',
  () => require('react-native-gesture-handler/lib/commonjs/mocks/mocks'),
);
jest.mock(
  'react-native-gesture-handler/lib/commonjs/specs/RNGestureHandlerButtonNativeComponent',
  () => ({
    __esModule: true,
    default: require('react-native').requireNativeComponent(
      'RNGestureHandlerButton',
    ),
  }),
);
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: jest.requireActual(
    'react-native-gesture-handler/lib/commonjs/components/touchables/TouchableOpacity',
  ).default,
}));

const mockSetLoginVisible = jest.fn();
jest.mock('../hooks/atom', () => ({
  useGasAccountSign: () => ({
    account: { address: '0x1111', type: 'WatchAddressKeyring' },
  }),
  useAccountsWithGasAccountBalance: () => [
    { address: '0x2222', type: 'WatchAddressKeyring' },
  ],
  useGasAccountLoginVisible: () => [false, mockSetLoginVisible],
}));
jest.mock('@/components', () => ({
  Tip: ({
    children,
    content,
    isVisible,
    onClose,
  }: React.PropsWithChildren<{
    content: React.ReactNode;
    isVisible: boolean;
    onClose: () => void;
  }>) => {
    const { View, Text } = require('react-native');
    return (
      <>
        {children}
        {isVisible ? (
          <View testID="gas-header-menu">
            {content}
            <Text onPress={onClose}>close-menu</Text>
          </View>
        ) : null}
      </>
    );
  },
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {}, colors2024: {} }),
  useThemeColors: () => ({}),
  useGetBinaryMode: () => 'light',
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/assets/icons/gas-account', () => ({
  RcIconGasAccountHeaderRight: () => {
    const { View } = require('react-native');
    return <View testID="gas-header-trigger-icon" />;
  },
}));
jest.mock('@/assets2024/icons/gas-account', () => ({
  RcIconSwitchCC: () => null,
  RcIconWithdrawCC: () => null,
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { gasAccountHeaderMenu: 'gas-account-header-menu' },
}));

describe('GasAccountHeader native trigger contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the RNGH host explicitly and preserves Tip open and close', () => {
    const showWithdraw = jest.fn();
    render(<GasAccountHeader showWithdraw={showWithdraw} />);

    expect(screen.UNSAFE_getByType(CustomTouchableOpacity).props.as).toBe(
      'RNGHTouchableOpacity',
    );
    expect(screen.UNSAFE_getByType(RNGHTouchableOpacity).props.hitSlop).toBe(
      10,
    );
    expect(screen.queryByTestId('gas-header-menu')).toBeNull();

    fireEvent.press(screen.getByTestId('gas-header-trigger-icon'));
    expect(screen.getByTestId('gas-header-menu')).toBeOnTheScreen();
    fireEvent.press(screen.getByText('close-menu'));
    expect(screen.queryByTestId('gas-header-menu')).toBeNull();
    expect(showWithdraw).not.toHaveBeenCalled();
    expect(mockSetLoginVisible).not.toHaveBeenCalled();
  });

  it.each(['withdraw', 'switchAccount'] as const)(
    'closes the menu and hands off %s once',
    option => {
      const showWithdraw = jest.fn();
      render(<GasAccountHeader showWithdraw={showWithdraw} />);
      fireEvent.press(screen.getByTestId('gas-header-trigger-icon'));
      fireEvent.press(screen.getByText(`page.gasAccount.${option}`));

      expect(screen.queryByTestId('gas-header-menu')).toBeNull();
      if (option === 'withdraw') {
        expect(showWithdraw).toHaveBeenCalledTimes(1);
        expect(mockSetLoginVisible).not.toHaveBeenCalled();
      } else {
        expect(mockSetLoginVisible).toHaveBeenCalledTimes(1);
        expect(mockSetLoginVisible).toHaveBeenCalledWith(true);
        expect(showWithdraw).not.toHaveBeenCalled();
      }
    },
  );
});
