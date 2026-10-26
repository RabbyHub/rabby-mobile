import { ThemeColors2024 } from '@/constant/theme';
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));

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

let mockIsLight = true;

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const themeColors = require('@/constant/theme').ThemeColors2024;
    const colors2024 = mockIsLight ? themeColors.light : themeColors.dark;
    return {
      colors2024,
      isLight: mockIsLight,
      styles: getStyle({
        colors2024,
        isLight: mockIsLight,
        safeAreaInsets: { bottom: 0 },
      }),
    };
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'page.perps.pro.orderBook.grouping' ? 'Order book grouping' : key,
  }),
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

describe.each(['light', 'dark'] as const)(
  'PerpsProPrecisionSheet (%s)',
  mode => {
    const colors = ThemeColors2024[mode];
    beforeEach(() => {
      mockIsLight = mode === 'light';
    });
    it('matches the grouping title, new cards, and existing selection intent', () => {
      const onClose = jest.fn();
      const onIntentStart = jest.fn();
      const onSelect = jest.fn();
      render(
        <PerpsProPrecisionSheet
          onClose={onClose}
          onIntentStart={onIntentStart}
          onSelect={onSelect}
          options={options}
          selected={options[1]}
        />,
      );

      const sheet = screen.getByTestId('perps-pro-precision-sheet');
      const selectedOption = screen.getByTestId('perps-pro-precision-5-2');
      expect(sheet.props.snapPoints).toEqual([484]);
      expect(mockMakeBottomSheetProps).toHaveBeenCalledWith(
        expect.objectContaining({ linearGradientType: 'bg0' }),
      );
      expect(StyleSheet.flatten(sheet.props.style)).toMatchObject({
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      });
      expect(
        StyleSheet.flatten(sheet.props.backgroundStyle).backgroundColor,
      ).toBe(colors['neutral-bg-0']);
      expect(
        StyleSheet.flatten(selectedOption.props.style).backgroundColor,
      ).toBe('rgba(80, 210, 193, 0.1)');
      const unselected = StyleSheet.flatten(
        screen.getByTestId('perps-pro-precision-5-null').props.style,
      );
      expect(unselected.backgroundColor).toBe(
        colors[mode === 'light' ? 'neutral-bg-1' : 'neutral-bg-2'],
      );
      expect(unselected.backgroundColor).not.toBe(
        StyleSheet.flatten(sheet.props.backgroundStyle).backgroundColor,
      );
      expect(StyleSheet.flatten(sheet.props.handleStyle)).toMatchObject({
        height: 40,
        paddingBottom: 24,
        paddingTop: 10,
      });
      expect(
        StyleSheet.flatten(sheet.props.handleIndicatorStyle),
      ).toMatchObject({
        height: 6,
        width: 50,
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-precision-options').props
            .contentContainerStyle,
        ),
      ).toMatchObject({ gap: 8, paddingBottom: 36, paddingHorizontal: 16 });
      expect(screen.getByText('Order book grouping')).toBeTruthy();
      expect(selectedOption.props.accessibilityState).toEqual({
        checked: true,
      });
      expect(screen.queryByTestId('perps-pro-precision-selected')).toBeNull();
      expect(StyleSheet.flatten(selectedOption.props.style)).toMatchObject({
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
      });

      fireEvent(screen.getByTestId('perps-pro-precision-5-2'), 'pressIn');
      expect(onIntentStart).toHaveBeenCalledWith(options[1]);
      fireEvent.press(screen.getByTestId('perps-pro-precision-5-2'));
      expect(onSelect).toHaveBeenCalledWith(options[1]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  },
);
