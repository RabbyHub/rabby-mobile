import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';

const mockBlur = jest.fn();
const mockFocus = jest.fn();
const mockInputProps = jest.fn();
let mockIsLight = true;

jest.mock('@/assets/icons/common/next-search-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets/icons/common/next-close-circle.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets/icons/common/next-close-circle-dark.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy(
      {},
      {
        get: (_target, key) => String(key),
      },
    );
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'global.Cancel' ? 'Cancel' : key),
  }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');

  return {
    BottomSheetTextInput: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        mockInputProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          blur: () => {
            mockBlur();
            (props.onBlur as (() => void) | undefined)?.();
          },
          focus: () => {
            mockFocus();
            (props.onFocus as (() => void) | undefined)?.();
          },
        }));
        return ReactModule.createElement(TextInput, props);
      },
    ),
  };
});

const { PerpsProMarketSearchBar } =
  require('./PerpsProMarketSearchBar') as typeof import('./PerpsProMarketSearchBar');

const getLatestInputProps = () =>
  mockInputProps.mock.calls[mockInputProps.mock.calls.length - 1][0];

describe('PerpsProMarketSearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLight = true;
  });

  it('matches the 34px resting design without a native placeholder', () => {
    const onFocusChange = jest.fn();
    render(
      <PerpsProMarketSearchBar
        onChangeText={jest.fn()}
        onFocusChange={onFocusChange}
        placeholder="Search"
        value=""
      />,
    );

    const containerStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-market-search-input-container').props.style,
    );
    expect(containerStyle).toEqual(
      expect.objectContaining({
        backgroundColor: 'neutral-bg-0',
        borderRadius: 6,
        gap: 8,
        height: 34,
        marginRight: 1,
        paddingHorizontal: 12,
      }),
    );
    expect(screen.getByText('Search').props.style).toEqual(
      expect.objectContaining({
        color: 'neutral-secondary',
        fontFamily: 'SF Pro',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
      }),
    );

    const restingInputStyle = StyleSheet.flatten(getLatestInputProps().style);
    expect(getLatestInputProps().placeholder).toBeUndefined();
    expect(restingInputStyle).toEqual(
      expect.objectContaining({
        fontFamily: 'SF Pro',
        fontSize: 14,
        fontWeight: '700',
        height: 18,
        includeFontPadding: false,
        lineHeight: 18,
        paddingVertical: 0,
      }),
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-search-focus-mask'));
    expect(mockFocus).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('market-search-cancel')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-market-search-active-placeholder'),
    ).toBeTruthy();
    expect(getLatestInputProps().selection).toEqual({ end: 0, start: 0 });
    expect(StyleSheet.flatten(getLatestInputProps().style)).toEqual(
      restingInputStyle,
    );
  });

  it('keeps clear focused and makes Cancel clear, blur, and dismiss the keyboard', () => {
    const keyboardDismissSpy = jest
      .spyOn(Keyboard, 'dismiss')
      .mockImplementation(jest.fn());
    const onChangeText = jest.fn();
    const onFocusChange = jest.fn();
    const { rerender } = render(
      <PerpsProMarketSearchBar
        onChangeText={onChangeText}
        onFocusChange={onFocusChange}
        placeholder="Search"
        value=""
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-market-search-focus-mask'));
    rerender(
      <PerpsProMarketSearchBar
        onChangeText={onChangeText}
        onFocusChange={onFocusChange}
        placeholder="Search"
        value="ETH"
      />,
    );

    expect(getLatestInputProps().selection).toBeUndefined();
    expect(
      screen.getByTestId('perps-pro-market-search-clear-light'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('market-search-clear'));
    expect(onChangeText).toHaveBeenLastCalledWith('');
    expect(mockBlur).not.toHaveBeenCalled();

    act(() => {
      fireEvent.press(screen.getByTestId('market-search-cancel'));
    });
    expect(onChangeText).toHaveBeenLastCalledWith('');
    expect(mockBlur).toHaveBeenCalledTimes(1);
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
    expect(keyboardDismissSpy).toHaveBeenCalledTimes(1);
    keyboardDismissSpy.mockRestore();
  });

  it('uses the dark clear asset without changing active geometry', () => {
    mockIsLight = false;
    render(
      <PerpsProMarketSearchBar
        onChangeText={jest.fn()}
        onFocusChange={jest.fn()}
        placeholder="Search"
        value="ETH"
      />,
    );

    expect(
      screen.getByTestId('perps-pro-market-search-clear-dark'),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-market-search-input-container').props
          .style,
      ),
    ).toEqual(
      expect.objectContaining({
        borderRadius: 6,
        height: 34,
        paddingHorizontal: 12,
      }),
    );
  });
});
