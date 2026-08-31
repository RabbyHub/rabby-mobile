import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, Text as NativeText } from 'react-native';

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

jest.mock('@/components/customized/BottomSheet', () => {
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
          testID: 'confirmation-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({
      buttonStyle,
      height,
      onPress,
      title,
      type,
    }: {
      buttonStyle?: object;
      height: number;
      onPress: () => void;
      title: string;
      type: string;
    }) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityValue: { text: `${height}:${type}` },
          onPress,
          style: buttonStyle,
          testID: 'confirm-button',
        },
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

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.trade.buy': 'Buy',
        'page.perps.pro.trade.confirmationReduceOnly': 'Reduce Only',
        'page.perps.pro.trade.long': 'Long',
        'page.perps.pro.trade.markPrice': 'Mark Price',
        'page.perps.pro.trade.market': 'Market',
        'page.perps.pro.trade.marketPrice': 'Market Price',
        'page.perps.pro.trade.no': 'No',
        'page.perps.pro.trade.sell': 'Sell',
        'page.perps.pro.trade.short': 'Short',
        'page.perps.pro.trade.yes': 'Yes',
      }[key] ??
      key.split('.').pop() ??
      key),
  }),
}));

import type { PerpsProOpenOrderCommand } from '../../actions/openOrder';
import type { PerpsProAttachedTpSlCommand } from '../../actions/openOrderWithAttachedTpSl';
import type { PerpsProMarket } from '../../model/market';
import type { PerpsProOrderReviewFacts } from '../../model/orderReview';
import { PerpsProOrderConfirmationSheet } from './PerpsProOrderConfirmationSheet';

const reviewFacts: PerpsProOrderReviewFacts = {
  amountUnit: 'quote',
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  formRevision: 1,
  generatedAt: 1,
  leverage: 10,
  marginMode: 'isolated',
  markPrice: '100',
  marketFillRiskEntryPrice: null,
  maxLeverage: 20,
  midPrice: '100',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: 'xyz',
  szDecimals: 2,
};

const parent: PerpsProOpenOrderCommand = {
  account: { address: '0x1', type: 'watch' },
  baseSize: '1',
  coin: 'BTC',
  dexId: '',
  execution: { kind: 'limit', limitPrice: '100', tif: 'Gtc' },
  marketKey: 'hyperliquid::BTC',
  orderType: 'limit',
  quoteAmount: '100',
  reduceOnly: false,
  reviewFacts,
  side: 'buy',
  type: 'openOrder',
};

const attached: PerpsProAttachedTpSlCommand = {
  accountRuntimeGeneration: 1,
  attached: {
    errors: [],
    expectedEntryPrice: '100',
    liquidationPrice: '50',
    normalizedBaseSize: '1',
    side: 'buy',
    sl: {
      estimatedPnl: '-10',
      estimatedRoi: '-100',
      kind: 'sl',
      mode: 'price',
      rawMagnitude: '90',
      triggerPrice: '90',
    },
    tp: {
      estimatedPnl: '10',
      estimatedRoi: '100',
      kind: 'tp',
      mode: 'price',
      rawMagnitude: '110',
      triggerPrice: '110',
    },
  },
  cloids: {
    parent: '0x11111111111111111111111111111111',
    stopLoss: '0x33333333333333333333333333333333',
    takeProfit: '0x22222222222222222222222222222222',
  },
  commandId: 'command-1',
  marketSnapshot: {
    entrySource: 'limit',
    expectedEntryPrice: '100',
    normalizedBaseSize: '1',
  },
  parent,
  parentFingerprint: 'parent-1',
  reviewFacts: {
    ...reviewFacts,
    expectedEntryPrice: '100',
    liquidationGap: -0.5,
    liquidationPrice: '50',
  },
  runtimeGeneration: 1,
  runtimeIdentity: '0x1::watch',
  type: 'openOrderWithAttachedTpSl',
};

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  marketData: { markPx: '105', pxDecimals: 2, szDecimals: 2 },
  marketKey: 'hyperliquid::BTC',
  quoteAsset: 'USDC',
} as PerpsProMarket;

const renderSheet = (
  command: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand,
  overrides: Partial<
    React.ComponentProps<typeof PerpsProOrderConfirmationSheet>
  > = {},
) =>
  render(
    <PerpsProOrderConfirmationSheet
      command={command}
      estimatedLiquidation={{ gap: -0.4, price: '55' }}
      market={market}
      onClose={jest.fn()}
      onConfirm={jest.fn()}
      onToggleSkip={jest.fn()}
      pending={false}
      skipConfirmation={false}
      {...overrides}
    />,
  );

describe('PerpsProOrderConfirmationSheet', () => {
  it('uses the Pro layout, live risk fields and Mark Price TP/SL conditions', () => {
    renderSheet(attached);

    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.getByText('xyz')).toBeTruthy();
    expect(screen.getByText('Isolated 10x')).toBeTruthy();
    expect(screen.getByText('Buy')).toBeTruthy();
    expect(screen.getByText('Long')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-side-tag').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'green-light-1',
      borderColor: 'green-light-2',
      borderRadius: 2,
      borderWidth: 0.5,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-position-tag').props
          .style,
      ),
    ).toMatchObject({ borderColor: 'green-light-2', borderWidth: 0.5 });
    expect(screen.getByText('Buy').props.style).toMatchObject({
      color: 'green-default',
      fontSize: 10,
      lineHeight: 12,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-source-tag').props
          .style,
      ),
    ).toMatchObject({
      borderColor: 'neutral-line',
      borderRadius: 2,
      borderWidth: 0.5,
      fontSize: 10,
      lineHeight: 12,
    });
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.getByText('105.00 USDC')).toBeTruthy();
    expect(screen.getByText('55.00 USDC (-40.00%)')).toBeTruthy();
    expect(screen.getByText('Mark Price ≥ 110.00 USDC')).toBeTruthy();
    expect(screen.getByText('Mark Price ≤ 90.00 USDC')).toBeTruthy();
    expect(screen.getByText('skipConfirmation')).toBeTruthy();
    expect(screen.queryByText('confirmAttachedTpSl')).toBeNull();
    expect(screen.queryByText('tpSlFullFillWarning')).toBeNull();
    expect(screen.queryByText('estimatedTpPnlRoi')).toBeNull();
    expect(
      screen.getByTestId('confirmation-sheet').props.enableDynamicSizing,
    ).toBe(true);
    expect(
      screen.getByTestId('confirmation-sheet').props.snapPoints,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-footer').props.style,
      ),
    ).toMatchObject({ paddingBottom: 40, paddingTop: 24 });
    expect(
      StyleSheet.flatten(screen.getByText('Isolated 10x').props.style),
    ).toMatchObject({ fontVariant: ['stylistic-six'] });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-footer').props.style,
      ).marginTop,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('confirmation-sheet').props.handleIndicatorStyle,
      ),
    ).toMatchObject({ height: 4, width: 40 });
    expect(
      screen.getByTestId('confirm-button').props.accessibilityValue,
    ).toEqual({ text: '36:primary' });
    expect(
      StyleSheet.flatten(screen.getByTestId('confirm-button').props.style),
    ).toMatchObject({ borderRadius: 8 });
  });

  it('uses the bordered negative badge contract for Sell and Short', () => {
    renderSheet({ ...parent, side: 'sell' });

    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-side-tag').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'red-light-1',
      borderColor: 'red-light-2',
      borderRadius: 2,
      borderWidth: 0.5,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-confirmation-position-tag').props
          .style,
      ),
    ).toMatchObject({ borderColor: 'red-light-2', borderWidth: 0.5 });
    expect(screen.getByText('Sell').props.style).toMatchObject({
      color: 'red-default',
      fontSize: 10,
      lineHeight: 12,
    });
  });

  it('renders unavailable liquidation as a double dash', () => {
    renderSheet(parent, { estimatedLiquidation: null });

    const detailTexts = screen
      .getByTestId('perps-pro-order-confirmation-details')
      .findAllByType(NativeText)
      .map(node => node.props.children);
    expect(detailTexts).toContain('--');
    expect(detailTexts).not.toContain('-');
  });

  it('keeps attached TP/SL on the same per-type skip preference control', () => {
    const onToggleSkip = jest.fn();
    renderSheet(attached, { onToggleSkip });

    fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggleSkip).toHaveBeenCalledTimes(1);
  });

  it('renders a six-digit integer attached TP trigger without truncation', () => {
    renderSheet({
      ...attached,
      attached: {
        ...attached.attached,
        tp: {
          ...attached.attached.tp!,
          rawMagnitude: '111111',
          triggerPrice: '111111',
        },
      },
    });

    expect(screen.getByText('Mark Price ≥ 111,111.00 USDC')).toBeTruthy();
  });

  it('shows the reviewed Reduce Only value', () => {
    renderSheet({ ...parent, reduceOnly: true });

    expect(screen.getByText('Reduce Only')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();

    const detailTexts = screen
      .getByTestId('perps-pro-order-confirmation-details')
      .findAllByType(NativeText)
      .map(node => node.props.children);
    expect(detailTexts).toEqual([
      'price',
      '100.00 USDC',
      'amount',
      '100.00 USDC',
      'Mark Price',
      '105.00 USDC',
      'estimatedLiquidationPrice',
      '55.00 USDC (-40.00%)',
      'Reduce Only',
      'Yes',
    ]);
  });

  it('renders Conditional Trigger Price and fixed Limit Price without Order Type', () => {
    renderSheet({
      ...parent,
      execution: {
        kind: 'conditionalLimit',
        limitPrice: '102',
        referencePrice: '100',
        tpsl: 'tp',
        triggerPrice: '110',
      },
      orderType: 'conditional',
    });

    expect(screen.getByText('triggerPrice')).toBeTruthy();
    expect(screen.getByText('110.00 USDC')).toBeTruthy();
    expect(screen.getByText('102.00 USDC')).toBeTruthy();
    expect(screen.queryByText('orderType')).toBeNull();
  });

  it('shows the BBO level instead of freezing a reviewed numeric price', () => {
    renderSheet({
      ...parent,
      bboSessionKey: 'BTC:1',
      execution: { kind: 'bboLimit', strategy: 'cp1' },
    });

    expect(screen.getByText('Counterparty 1')).toBeTruthy();
    expect(screen.getAllByText('100.00 USDC')).toHaveLength(1);
  });
});
