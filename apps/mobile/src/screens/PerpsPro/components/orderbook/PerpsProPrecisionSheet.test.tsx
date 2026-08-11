import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockMakeBottomSheetProps = jest.fn(() => ({}));

jest.mock('@/assets2024/icons/perps/PerpsProOptionCheck.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (
        { children, ...props }: { children: React.ReactNode },
        ref: React.Ref<unknown>,
      ) => {
        ReactModule.useImperativeHandle(ref, () => ({
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          children,
          testID: 'perps-pro-precision-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: (input: object) => mockMakeBottomSheetProps(input),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: true,
      styles: getStyle({ colors2024 }),
    };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').View,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
}));

import type { PerpsTickOption } from '../../model/orderBook';
import { PerpsProPrecisionSheet } from './PerpsProPrecisionSheet';

const options: PerpsTickOption[] = [
  { displayPrice: 0.1, mantissa: null, nSigFigs: 5, priceDecimals: 1 },
  { displayPrice: 0.2, mantissa: 2, nSigFigs: 5, priceDecimals: 1 },
  { displayPrice: 0.5, mantissa: 5, nSigFigs: 5, priceDecimals: 1 },
  { displayPrice: 1, mantissa: null, nSigFigs: 4, priceDecimals: 0 },
  { displayPrice: 10, mantissa: null, nSigFigs: 3, priceDecimals: 0 },
  { displayPrice: 100, mantissa: null, nSigFigs: 2, priceDecimals: 0 },
];

describe('PerpsProPrecisionSheet', () => {
  it('matches the compact no-title option layout and selected icon', () => {
    const onClose = jest.fn();
    const onSelect = jest.fn();
    render(
      <PerpsProPrecisionSheet
        onClose={onClose}
        onSelect={onSelect}
        options={options}
        selected={options[1]}
      />,
    );

    const sheet = screen.getByTestId('perps-pro-precision-sheet');
    const selectedOption = screen.getByTestId('perps-pro-precision-5-2');
    expect(sheet.props.snapPoints).toEqual([376]);
    expect(mockMakeBottomSheetProps).toHaveBeenCalledWith(
      expect.objectContaining({ linearGradientType: 'bg1' }),
    );
    expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    });
    expect(
      StyleSheet.flatten(sheet.props.backgroundStyle).backgroundColor,
    ).toBe('neutral-bg-1');
    expect(StyleSheet.flatten(selectedOption.props.style).backgroundColor).toBe(
      StyleSheet.flatten(sheet.props.backgroundStyle).backgroundColor,
    );
    expect(StyleSheet.flatten(sheet.props.handleStyle)).toMatchObject({
      height: 40,
      paddingBottom: 27,
      paddingTop: 9,
    });
    expect(StyleSheet.flatten(sheet.props.handleIndicatorStyle)).toMatchObject({
      height: 4,
      width: 40,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-precision-options').props
          .contentContainerStyle,
      ),
    ).toMatchObject({ gap: 8, paddingBottom: 48, paddingHorizontal: 15 });
    expect(screen.queryByText('Price Aggregation')).toBeNull();
    expect(screen.getByTestId('perps-pro-precision-selected')).toBeTruthy();
    expect(StyleSheet.flatten(selectedOption.props.style)).toMatchObject({
      borderRadius: 12,
      minHeight: 40,
      paddingVertical: 8,
    });

    fireEvent.press(screen.getByTestId('perps-pro-precision-5-2'));
    expect(onSelect).toHaveBeenCalledWith(options[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
