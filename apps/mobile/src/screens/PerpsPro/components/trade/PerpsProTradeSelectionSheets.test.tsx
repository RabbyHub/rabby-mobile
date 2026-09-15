jest.mock('@/assets2024/icons/perps/PerpsProOrderTypeLimit.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'order-type-limit-svg',
    });
});

jest.mock('@/assets2024/icons/perps/PerpsProOrderTypeMarket.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'order-type-market-svg',
    });
});

jest.mock('@/assets2024/icons/perps/PerpsProOrderTypeConditional.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'order-type-conditional-svg',
    });
});
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import { ThemeColors2024 } from '@/constant/theme';
import { PERPS_PRO_DIALOG_TOKENS } from '../common/perpsProDialogVisual';

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
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          children,
          testID: 'selection-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
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

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.positions.cross': 'Cross',
        'page.perps.pro.trade.conditional': 'Conditional',
        'page.perps.pro.trade.conditionalDescription':
          'Place a limit or market order when target price is reached',
        'page.perps.pro.trade.crossDescription': 'Cross description',
        'page.perps.pro.trade.isolated': 'Isolated',
        'page.perps.pro.trade.isolatedDescription': 'Isolated description',
        'page.perps.pro.trade.limit': 'Limit',
        'page.perps.pro.trade.limitDescription': 'Limit description',
        'page.perps.pro.trade.marginMode': 'Margin Mode',
        'page.perps.pro.trade.market': 'Market',
        'page.perps.pro.trade.marketDescription': 'Market description',
        'page.perps.pro.trade.orderType': 'Order Type',
        'page.perps.pro.trade.gtcDescription': 'Good Till Cancel',
        'page.perps.pro.trade.iocDescription': 'Immediate or Cancel',
        'page.perps.pro.trade.aloDescription': 'Add Liquidity Only',
        'page.perps.pro.trade.pnl': 'PnL',
        'page.perps.pro.trade.price': 'Price',
        'page.perps.pro.trade.roi': 'ROI%',
        'page.perps.pro.trade.tpSlPnlDescription':
          'Set TP/SL prices based on estimated PnL',
        'page.perps.pro.trade.tpSlPriceDescription':
          'Execute your TP/SL based on the crypto price.',
        'page.perps.pro.trade.tpSlRoiDescription':
          'Set TP/SL prices based on estimated ROI%',
        'page.perps.pro.trade.tpSlSettings': 'TP/SL Settings',
        'page.perps.pro.trade.timeInForce': 'Time in Force',
      }[key] ?? key),
  }),
}));

import { PerpsProBboSheet } from './PerpsProBboSheet';
import { PerpsProMarginModeSheet } from './PerpsProMarginModeSheet';
import { PerpsProOrderTypeSheet } from './PerpsProOrderTypeSheet';
import { PerpsProTifSheet } from './PerpsProTifSheet';
import { PerpsProTpSlModeSheet } from './PerpsProTpSlModeSheet';

describe.each(['light', 'dark'] as const)(
  'Perps Pro trade selection sheets (%s)',
  mode => {
    const colors = ThemeColors2024[mode];
    const expectOptionSurfaces = () => {
      const sheetBackground = StyleSheet.flatten(
        screen.getByTestId('selection-sheet').props.backgroundStyle,
      ).backgroundColor;
      for (const option of screen.getAllByRole('radio', { disabled: false })) {
        const style = StyleSheet.flatten(option.props.style);
        expect(style.backgroundColor).not.toBe(sheetBackground);
        expect(style.backgroundColor).toBe(
          option.props.accessibilityState.checked
            ? PERPS_PRO_DIALOG_TOKENS.selectedBackground
            : colors[mode === 'light' ? 'neutral-bg-1' : 'neutral-bg-2'],
        );
      }
    };
    beforeEach(() => {
      mockIsLight = mode === 'light';
    });
    it('matches the new Margin Mode card layout', async () => {
      const onClose = jest.fn();
      const onSelect = jest.fn(() => true);
      render(
        <PerpsProMarginModeSheet
          marketName="BTC"
          onClose={onClose}
          onSelect={onSelect}
          selected="cross"
          visible
        />,
      );

      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
      expect(
        StyleSheet.flatten(screen.getByTestId('selection-sheet').props.style),
      ).toMatchObject({
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.backgroundStyle,
        ),
      ).toMatchObject({
        backgroundColor: colors['neutral-bg-0'],
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleStyle,
        ),
      ).toMatchObject({
        backgroundColor: colors['neutral-bg-0'],
        height: 40,
        paddingBottom: 24,
        paddingTop: 10,
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleIndicatorStyle,
        ),
      ).toMatchObject({
        backgroundColor: colors['neutral-sheet-handle'],
        borderRadius: 3,
        height: 6,
        width: 50,
      });
      expect(screen.getByText('BTC Margin Mode')).toBeTruthy();
      expect(
        StyleSheet.flatten(screen.getByText('Cross').props.style),
      ).toMatchObject({ fontSize: 16, lineHeight: 20 });
      expect(
        StyleSheet.flatten(screen.getByText('Cross description').props.style),
      ).toMatchObject({ fontSize: 14, lineHeight: 18 });
      expect(
        screen.getByTestId('perps-pro-margin-mode-cross').props
          .accessibilityState,
      ).toEqual({ checked: true, disabled: false });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-margin-mode-cross').props.style,
        ),
      ).toMatchObject({
        backgroundColor: 'rgba(80, 210, 193, 0.1)',
        borderColor: 'rgba(35, 192, 176, 0.4)',
      });
      expect(screen.queryByTestId('perps-pro-margin-mode-selected')).toBeNull();

      fireEvent.press(screen.getByTestId('perps-pro-margin-mode-isolated'));
      expect(onSelect).toHaveBeenCalledWith('isolated');
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('keeps Margin Mode selection visible without rendering a check icon', () => {
      render(
        <PerpsProMarginModeSheet
          marketName="BTC"
          onClose={jest.fn()}
          onSelect={jest.fn()}
          selected="isolated"
          visible
        />,
      );

      const isolatedCopy = screen.getByTestId(
        'perps-pro-margin-mode-isolated-copy',
      );
      expect(StyleSheet.flatten(isolatedCopy.props.style)).toMatchObject({
        alignSelf: 'stretch',
        gap: 8,
      });
      expect(
        screen.getByTestId('perps-pro-margin-mode-isolated').props
          .accessibilityState,
      ).toEqual({ checked: true, disabled: false });
      expect(
        screen.getByTestId('perps-pro-margin-mode-cross').props
          .accessibilityState,
      ).toEqual({ checked: false, disabled: false });
      expect(screen.queryByTestId('perps-pro-margin-mode-selected')).toBeNull();
      expect(screen.getByText('Isolated description')).toBeTruthy();
      const crossTitleStyle = StyleSheet.flatten(
        screen.getByText('Cross').props.style,
      );
      const isolatedTitleStyle = StyleSheet.flatten(
        screen.getByText('Isolated').props.style,
      );
      expect(crossTitleStyle).toEqual(isolatedTitleStyle);
      expect(crossTitleStyle).toMatchObject({
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 20,
      });
      expect(crossTitleStyle.fontVariant).toBeUndefined();
      expect(isolatedTitleStyle.fontVariant).toBeUndefined();
    });

    it('locks Margin Mode dismissal and options while the server update is pending', () => {
      const onSelect = jest.fn(() => true);
      render(
        <PerpsProMarginModeSheet
          marketName="BTC"
          onClose={jest.fn()}
          onSelect={onSelect}
          pending
          selected="cross"
          visible
        />,
      );

      expect(
        screen.getByTestId('selection-sheet').props.enablePanDownToClose,
      ).toBe(false);
      expect(
        screen.getByTestId('perps-pro-margin-mode-isolated').props
          .accessibilityState,
      ).toEqual({ checked: false, disabled: true });
      fireEvent.press(screen.getByTestId('perps-pro-margin-mode-isolated'));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('matches the new Order Type card layout', () => {
      const onSelect = jest.fn();
      render(
        <PerpsProOrderTypeSheet
          onClose={jest.fn()}
          onSelect={onSelect}
          selected="limit"
          visible
        />,
      );

      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
      expect(
        StyleSheet.flatten(screen.getByText('Order Type').props.style),
      ).toMatchObject({ fontSize: 20, lineHeight: 24 });
      expect(screen.queryByTestId('perps-pro-order-type-help')).toBeNull();
      expect(
        screen.getByTestId('perps-pro-order-type-limit').props
          .accessibilityState,
      ).toEqual({ checked: true });
      expect(screen.queryByTestId('perps-pro-order-type-selected')).toBeNull();
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.backgroundStyle,
        ),
      ).toMatchObject({
        backgroundColor: colors['neutral-bg-0'],
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleIndicatorStyle,
        ),
      ).toMatchObject({ height: 6, width: 50 });
      for (const kind of ['limit', 'market', 'conditional']) {
        expect(screen.getByTestId(`order-type-${kind}-svg`).props.fill2).toBe(
          colors[mode === 'light' ? 'neutral-bg-1' : 'neutral-bg-2'],
        );
      }
      expect(screen.getByText('Limit description')).toBeTruthy();
      expect(screen.getByText('Market description')).toBeTruthy();
      expect(
        screen.getByText(
          'Place a limit or market order when target price is reached',
        ),
      ).toBeTruthy();

      fireEvent.press(screen.getByTestId('perps-pro-order-type-market'));
      expect(onSelect).toHaveBeenCalledWith('market');
    });

    it('matches the new BBO card layout', () => {
      const onSelect = jest.fn();
      render(
        <PerpsProBboSheet
          onClose={jest.fn()}
          onSelect={onSelect}
          options={[
            { label: 'Counterparty 1', value: 'cp1' },
            { label: 'Counterparty 5', value: 'cp5' },
            { label: 'Queue 1', value: 'q1' },
            { label: 'Queue 5', value: 'q5' },
          ]}
          selected="cp1"
          visible
        />,
      );

      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
      expect(
        StyleSheet.flatten(screen.getByText('BBO').props.style),
      ).toMatchObject({ fontSize: 20, lineHeight: 24 });
      expect(screen.queryByTestId('perps-pro-bbo-help')).toBeNull();
      expect(
        StyleSheet.flatten(screen.getByText('Counterparty 1').props.style),
      ).toMatchObject({ fontSize: 16, lineHeight: 20 });
      expect(
        screen.getByTestId('perps-pro-bbo-cp1').props.accessibilityState,
      ).toEqual({ checked: true });
      expect(screen.queryByTestId('perps-pro-bbo-selected')).toBeNull();
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleIndicatorStyle,
        ),
      ).toMatchObject({ height: 6, width: 50 });

      fireEvent.press(screen.getByTestId('perps-pro-bbo-q5'));
      expect(onSelect).toHaveBeenCalledWith('q5');
    });

    it('matches the new TP/SL Settings card layout', () => {
      const onSelect = jest.fn();
      render(
        <PerpsProTpSlModeSheet
          onClose={jest.fn()}
          onSelect={onSelect}
          selected="price"
          visible
        />,
      );

      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
      expect(
        StyleSheet.flatten(screen.getByText('TP/SL Settings').props.style),
      ).toMatchObject({ fontSize: 20, lineHeight: 24 });
      expect(
        StyleSheet.flatten(screen.getByText('Price').props.style),
      ).toMatchObject({ fontSize: 16, lineHeight: 20 });
      expect(
        StyleSheet.flatten(
          screen.getByText('Execute your TP/SL based on the crypto price.')
            .props.style,
        ),
      ).toMatchObject({ fontSize: 14, lineHeight: 18 });
      expect(
        screen.getByTestId('perps-pro-tpsl-mode-price').props
          .accessibilityState,
      ).toEqual({ checked: true });
      expect(screen.queryByTestId('perps-pro-tpsl-mode-selected')).toBeNull();
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleIndicatorStyle,
        ),
      ).toMatchObject({ height: 6, width: 50 });

      fireEvent.press(screen.getByTestId('perps-pro-tpsl-mode-roi'));
      expect(onSelect).toHaveBeenCalledWith('roi');
    });

    it('can restrict the Position TP/SL mode sheet to PnL and ROI', () => {
      render(
        <PerpsProTpSlModeSheet
          allowedModes={['pnl', 'roi']}
          onClose={jest.fn()}
          onSelect={jest.fn()}
          selected="pnl"
          visible
        />,
      );

      expect(screen.queryByTestId('perps-pro-tpsl-mode-price')).toBeNull();
      expect(screen.getByTestId('perps-pro-tpsl-mode-pnl')).toBeTruthy();
      expect(screen.getByTestId('perps-pro-tpsl-mode-roi')).toBeTruthy();
      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
    });

    it('matches the new Time in Force card layout', () => {
      const onClose = jest.fn();
      const onSelect = jest.fn();
      render(
        <PerpsProTifSheet
          onClose={onClose}
          onSelect={onSelect}
          selected="Gtc"
          visible
        />,
      );

      expectOptionSurfaces();

      expect(
        screen.getByTestId('selection-sheet').props.enableDynamicSizing,
      ).toBe(true);
      expect(
        StyleSheet.flatten(screen.getByText('Time in Force').props.style),
      ).toMatchObject({ fontSize: 20, lineHeight: 24 });
      expect(
        StyleSheet.flatten(screen.getByTestId('perps-pro-tif-gtc').props.style),
      ).toMatchObject({
        backgroundColor: 'rgba(80, 210, 193, 0.1)',
        borderColor: 'rgba(35, 192, 176, 0.4)',
        borderRadius: 12,
        padding: 15,
        borderWidth: 1,
      });
      expect(screen.getByText('Good Till Cancel')).toBeTruthy();
      expect(screen.getByText('Immediate or Cancel')).toBeTruthy();
      expect(screen.getByText('Add Liquidity Only')).toBeTruthy();
      expect(
        screen.getByTestId('perps-pro-tif-gtc').props.accessibilityState,
      ).toEqual({ checked: true });
      expect(screen.queryByTestId('perps-pro-tif-selected')).toBeNull();
      expect(
        StyleSheet.flatten(
          screen.getByTestId('selection-sheet').props.handleIndicatorStyle,
        ),
      ).toMatchObject({ height: 6, width: 50 });

      fireEvent.press(screen.getByTestId('perps-pro-tif-alo'));
      expect(onSelect).toHaveBeenCalledWith('Alo');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  },
);
