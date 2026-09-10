import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/assets2024/icons/common/checkbox-empty-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});
jest.mock('@/assets2024/icons/common/checkbox-filled-brand.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});
jest.mock('@/components/AutoLockView', () => require('react-native').View);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, {
          ...props,
          testID: 'close-confirmation-sheet',
        });
      },
    ),
  };
});
jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ title, type }: { title: string; type: string }) =>
      ReactModule.createElement(
        Pressable,
        { testID: 'close-confirmation-button', type },
        ReactModule.createElement(Text, null, title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      styles: getStyle({ colors2024, safeAreaInsets: { bottom: 0 } }),
    };
  },
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/utils/modalGate', () => ({
  MODAL_GATE_IDS: { perpsProCloseConfirmation: 'close-confirmation' },
  useRegisterBlockingModal: jest.fn(),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'page.perps.pro.openOrders.buy': 'Buy',
        'page.perps.pro.openOrders.sell': 'Sell',
        'page.perps.pro.positions.amount': 'Amount',
        'page.perps.pro.positions.long': 'Long',
        'page.perps.pro.positions.marketPrice': 'Market Price',
        'page.perps.pro.positions.price': 'Price',
        'page.perps.pro.positions.short': 'Short',
        'page.perps.pro.positions.skipLimitConfirmation':
          "Don't display double confirmation for Limit Order again.",
        'page.perps.pro.positions.skipMarketCloseConfirmation':
          "Don't show this Market Close confirmation again.",
      }[key] ?? key),
  }),
}));

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsProCloseDraft } from '../../model/positionAction';
import { PerpsProCloseConfirmationSheet } from './PerpsProCloseConfirmationSheet';

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '60000',
  midPrice: '60000',
  pxDecimals: 0,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 4,
};
const position = {
  direction: 'long',
} as PerpsPositionViewModel;
const draft = {
  inputSource: 'slider',
  limitPrice: '61000',
  midPrice: '60000',
  orderType: 'limit',
  percent: 100,
  referencePrice: '61000',
  size: '0.5',
} satisfies PerpsProCloseDraft;

describe('PerpsProCloseConfirmationSheet', () => {
  it('matches the compact Limit confirmation content and closing direction', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={draft}
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending={false}
        position={position}
        skipConfirmation={false}
        visible
      />,
    );

    expect(
      screen.getByTestId('close-confirmation-sheet').props.snapPoints,
    ).toEqual([302]);
    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.getByText('Sell')).toBeTruthy();
    expect(screen.getByText('Short')).toBeTruthy();
    for (const testID of [
      'perps-pro-close-confirmation-side-tag',
      'perps-pro-close-confirmation-position-tag',
    ]) {
      const tagStyle = StyleSheet.flatten(
        screen.getByTestId(testID).props.style,
      );
      expect(tagStyle).toMatchObject({
        backgroundColor: 'red-light-1',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
      });
      expect(tagStyle.borderColor).toBeUndefined();
      expect(tagStyle.borderWidth).toBeUndefined();
    }
    expect(screen.getByText('Sell').props.style).toMatchObject({
      color: 'red-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByText('Short').props.style).toMatchObject({
      color: 'red-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByText('61,000 USDC')).toBeTruthy();
    expect(screen.getByText('0.5000 BTC')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
    expect(screen.queryByTestId('perps-pro-close-market-tag')).toBeNull();
    expect(screen.getByTestId('close-confirmation-button').props.type).toBe(
      'primary',
    );
    expect(
      screen.getByText(
        "Don't display double confirmation for Limit Order again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Confirm Close')).toBeNull();
  });

  it('keeps Buy and Long on the positive direction tag contract', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={draft}
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending={false}
        position={{
          ...position,
          direction: 'short',
        }}
        skipConfirmation={false}
        visible
      />,
    );

    expect(screen.getByText('Buy').props.style).toMatchObject({
      color: 'green-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByText('Long').props.style).toMatchObject({
      color: 'green-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    for (const testID of [
      'perps-pro-close-confirmation-side-tag',
      'perps-pro-close-confirmation-position-tag',
    ]) {
      const tagStyle = StyleSheet.flatten(
        screen.getByTestId(testID).props.style,
      );
      expect(tagStyle).toMatchObject({
        backgroundColor: 'green-light-1',
        borderRadius: 4,
      });
      expect(tagStyle.borderColor).toBeUndefined();
      expect(tagStyle.borderWidth).toBeUndefined();
    }
  });

  it('uses Market Price with its own opt-in confirmation preference', () => {
    const onToggleSkipConfirmation = jest.fn();
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={{ ...draft, limitPrice: null, orderType: 'market' }}
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={onToggleSkipConfirmation}
        pending={false}
        position={position}
        skipConfirmation={false}
        visible
      />,
    );

    expect(
      screen.getByTestId('close-confirmation-sheet').props.snapPoints,
    ).toEqual([302]);
    expect(screen.getByText('Market Price')).toBeTruthy();
    expect(
      screen.getByText("Don't show this Market Close confirmation again."),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggleSkipConfirmation).toHaveBeenCalledTimes(1);
  });

  it('renders the normalized market source instead of a hardcoded Perp tag', () => {
    render(
      <PerpsProCloseConfirmationSheet
        amountUnit="base"
        draft={draft}
        market={{ ...market, sourceTag: 'xyz' }}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending
        position={position}
        skipConfirmation={false}
        visible
      />,
    );

    expect(screen.getByText('xyz')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
    const sourceTagStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-close-market-tag').props.style,
    );
    expect(sourceTagStyle).toMatchObject({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(sourceTagStyle.borderColor).toBeUndefined();
    expect(sourceTagStyle.borderWidth).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByText('xyz').props.style),
    ).toMatchObject({
      color: 'neutral-foot',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByTestId('close-confirmation-sheet').props).toMatchObject({
      backdropProps: { pressBehavior: 'none' },
      enablePanDownToClose: false,
    });
  });
});
