import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { CurrencySelectorPopup } from './CurrencySelectorPopup';

// Component contract only: native keyboard/gesture arbitration is verified in
// the Android package. Keep the real SearchBar so hiding its input is detected.
jest.mock('@/assets/icons/common', () => {
  const { View } = require('react-native');
  return {
    RcIconCheckmarkCC: View,
    RcNextSearchCC: View,
    RcNextCloseCircle: View,
    RcNextCloseCircleDark: View,
  };
});
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (ctx: object) => object }) => {
    const colors2024 = new Proxy({}, { get: () => '#000000' });
    return {
      styles: getStyle({ colors2024, isLight: true }),
      colors: colors2024,
      colors2024,
      isLight: true,
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currency: { code: 'USD' },
    currencyStore: {
      currencyList: [
        { code: 'USD', symbol: '$', logo_url: '' },
        { code: 'EUR', symbol: '€', logo_url: '' },
      ],
    },
    setCurrentCurrency: jest.fn(),
  }),
}));
jest.mock('@/components', () => {
  const ReactModule = require('react') as typeof React;
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef((props: object, ref) => {
      ReactModule.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        close: jest.fn(),
      }));
      return ReactModule.createElement(View, props);
    }),
  };
});
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@/components/customized/BottomSheetTextInput', () => ({
  AppBottomSheetTextInput: require('react-native').TextInput,
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').ScrollView,
}));
jest.mock('react-native-gesture-handler', () => ({
  TouchableOpacity: require('react-native').TouchableOpacity,
  TouchableWithoutFeedback: require('react-native').TouchableWithoutFeedback,
}));
jest.mock('react-native-fast-image', () => require('react-native').Image);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('CurrencySelectorPopup search', () => {
  it('keeps the inactive search input laid out and restores search after cancel', () => {
    render(<CurrencySelectorPopup />);
    const input = screen.getByPlaceholderText('page.setting.searchCurrency');
    expect(input).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'page.setting.searchCurrency' }),
    ).toBeVisible();

    fireEvent(input, 'focus', { nativeEvent: { target: 1 } });
    expect(
      screen.queryByRole('button', { name: 'page.setting.searchCurrency' }),
    ).toBeNull();
    fireEvent.changeText(input, 'EUR');
    expect(screen.getByText('EUR (€)')).toBeVisible();
    expect(screen.queryByText('USD ($)')).toBeNull();

    fireEvent.press(screen.getByText('global.Cancel'));
    expect(
      screen.getByPlaceholderText('page.setting.searchCurrency'),
    ).toBeVisible();
    expect(
      screen.getByPlaceholderText('page.setting.searchCurrency').props.value,
    ).toBe('');
    expect(screen.getByText('USD ($)')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'page.setting.searchCurrency' }),
    ).toBeVisible();
  });
});
