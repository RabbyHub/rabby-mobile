import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

type MockMarketIdentity = {
  displayBase: string;
  displayPair: string;
  metadataReady: boolean;
  pxDecimals: number | undefined;
  quoteAsset: 'USDC' | 'USDE' | null;
  sourceTag: string | null;
  szDecimals: number | undefined;
};
const mockReadyMarket: MockMarketIdentity = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  metadataReady: true,
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: 'xyz',
  szDecimals: 3,
};
let mockMarketIdentity: MockMarketIdentity = mockReadyMarket;

jest.mock('@/assets2024/icons/perps/IconPerpEdit.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024, isLight: true }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.openOrders.amount': 'Amount',
        'page.perps.pro.openOrders.buy': 'Buy',
        'page.perps.pro.openOrders.cancel': 'Cancel',
        'page.perps.pro.openOrders.conditions': 'Conditions',
        'page.perps.pro.openOrders.edit': 'Edit',
        'page.perps.pro.openOrders.filled': 'Filled',
        'page.perps.pro.openOrders.mark': 'Mark',
        'page.perps.pro.openOrders.market': 'Market',
        'page.perps.pro.openOrders.no': 'No',
        'page.perps.pro.openOrders.price': 'Price',
        'page.perps.pro.openOrders.reduceOnly': 'Reduce Only',
        'page.perps.pro.openOrders.sell': 'Sell',
        'page.perps.pro.openOrders.yes': 'Yes',
      }[key] || key),
  }),
}));

jest.mock('../../scene/usePerpsProMarketIdentity', () => ({
  usePerpsProMarketIdentity: () => mockMarketIdentity,
}));

jest.mock('../loading/PerpsProSkeletonBlock', () => ({
  PerpsProSkeletonBlock: require('react-native').View,
}));

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import { PerpsProOpenOrderCard } from './PerpsProOpenOrderCard';

const order = (
  overrides: Partial<PerpsOpenOrderViewModel> = {},
): PerpsOpenOrderViewModel => ({
  amountBase: '2',
  amountQuote: '200',
  category: 'basic',
  cloid: null,
  coin: 'BTC',
  displayAmountQuote: '200',
  editKind: 'limit',
  executionPrice: '100',
  executionPriceKind: 'limit',
  filledQuote: '100',
  filledRatio: '0.5',
  filledSize: '1',
  hasChildren: false,
  key: 'basic:BTC:1',
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: false,
  limitPrice: '100',
  oid: 1,
  orderType: 'Limit',
  reduceOnly: false,
  remainingSize: '1',
  side: 'buy',
  tif: 'Gtc',
  timestamp: 1_700_000_000_000,
  triggerCondition: null,
  triggerKind: null,
  triggerPrice: null,
  ...overrides,
});

describe('PerpsProOpenOrderCard', () => {
  beforeEach(() => {
    mockMarketIdentity = mockReadyMarket;
  });

  it('keeps HIP-3 routing identity out of labels until quote metadata arrives', () => {
    mockMarketIdentity = {
      displayBase: 'BTC',
      displayPair: 'BTC',
      metadataReady: false,
      pxDecimals: undefined,
      quoteAsset: null,
      sourceTag: 'hyna',
      szDecimals: undefined,
    };
    const onPressMarket = jest.fn();
    const value = order({
      coin: 'hyna:BTC',
      key: 'basic:hyna:BTC:1',
    });
    const view = render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        onPressMarket={onPressMarket}
        order={value}
      />,
    );

    expect(screen.queryByText('BTC')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-order-market-basic:hyna:BTC:1-skeleton'),
    ).toBeTruthy();
    expect(screen.getByText('hyna')).toBeTruthy();
    expect(screen.queryByText('hyna:BTC')).toBeNull();
    expect(screen.getByText('Filled / Amount')).toBeTruthy();
    fireEvent.press(
      screen.getByTestId('perps-pro-order-market-basic:hyna:BTC:1'),
    );
    expect(onPressMarket).toHaveBeenCalledWith('hyna:BTC');

    mockMarketIdentity = {
      ...mockReadyMarket,
      displayPair: 'BTCUSDE',
      quoteAsset: 'USDE',
      sourceTag: 'hyna',
    };
    view.rerender(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        onPressMarket={onPressMarket}
        order={value}
      />,
    );
    expect(screen.getByText('BTCUSDE')).toBeTruthy();
    expect(
      screen.queryByTestId('perps-pro-order-market-basic:hyna:BTC:1-skeleton'),
    ).toBeNull();
    expect(screen.getByText('Filled / Amount (USDE)')).toBeTruthy();
  });

  it('opens the market represented by the pair label', () => {
    const onPressMarket = jest.fn();
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        onPressMarket={onPressMarket}
        order={order()}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-order-market-basic:BTC:1'));
    expect(onPressMarket).toHaveBeenCalledWith('BTC');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-basic:BTC:1').props.style,
      ),
    ).toMatchObject({
      borderBottomColor: 'neutral-bg-5',
      borderBottomWidth: 1,
    });
  });

  it('shows Basic progress in the base asset and an enabled cancel entry', () => {
    const onCancel = jest.fn();
    render(
      <PerpsProOpenOrderCard
        amountUnit="base"
        cancelPending={false}
        onCancel={onCancel}
        order={order()}
      />,
    );

    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    const buySideTagStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-order-side-basic:BTC:1').props.style,
    );
    expect(buySideTagStyle).toMatchObject({
      backgroundColor: 'green-light-1',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(buySideTagStyle.borderColor).toBeUndefined();
    expect(buySideTagStyle.borderWidth).toBeUndefined();
    expect(screen.getByText('Buy').props.style).toMatchObject({
      color: 'green-default',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByText('50%')).toBeTruthy();
    expect(screen.getByText('50%').props.style).toMatchObject({
      color: 'neutral-secondary',
      fontFamily: 'SF Pro',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-progress-basic:BTC:1').props.style,
      ),
    ).toMatchObject({
      alignItems: 'center',
      gap: 2,
      height: 16,
      justifyContent: 'center',
      width: 32,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-progress-track-basic:BTC:1').props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-line',
      borderRadius: 1,
      height: 2,
      width: 32,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-progress-fill-basic:BTC:1').props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'green-default',
      height: 2,
      width: '50%',
    });
    expect(screen.getByText('Filled / Amount (BTC)')).toBeTruthy();
    expect(screen.getByText('1.000 / 2.000')).toBeTruthy();
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(screen.getByText('Cancel').props.style).toMatchObject({
      color: 'neutral-title-1',
      fontFamily: 'SF Pro',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 18,
    });
    expect(StyleSheet.flatten(cancelButton.props.style)).toMatchObject({
      backgroundColor: 'neutral-bg-2',
      borderRadius: 6,
      height: 26,
      width: 64,
    });
    const pressabilityConfig =
      cancelButton.props.onStartShouldSetResponder.testOnly_pressabilityConfig();
    act(() => pressabilityConfig.onPressIn({}));
    expect(StyleSheet.flatten(cancelButton.props.style)).toMatchObject({
      opacity: 0.6,
    });
    act(() => pressabilityConfig.onPressOut({}));
    fireEvent.press(cancelButton);
    expect(onCancel).toHaveBeenCalledWith(expect.objectContaining({ oid: 1 }));
    expect(screen.getByText('Price')).toBeTruthy();
    expect(screen.queryByText('Price (USDC)')).toBeNull();
    expect(screen.queryByText('Conditions')).toBeNull();
  });

  it('shows Conditional Mark trigger facts without a fabricated progress row', () => {
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        order={order({
          category: 'conditional',
          displayAmountQuote: '67.26',
          executionPrice: null,
          executionPriceKind: 'market',
          filledRatio: '0',
          key: 'conditional:BTC:2',
          oid: 2,
          orderType: 'Stop Market',
          reduceOnly: true,
          side: 'sell',
          triggerCondition: 'Below',
          triggerPrice: '90',
        })}
      />,
    );

    expect(screen.getByText('Conditions')).toBeTruthy();
    expect(screen.getByText('Below')).toBeTruthy();
    expect(screen.getByText('Amount (USDC)')).toBeTruthy();
    expect(screen.getByText('67.26')).toBeTruthy();
    expect(screen.queryByText('0.00')).toBeNull();
    expect(screen.getByText('Reduce Only')).toBeTruthy();
    expect(screen.getByText('Yes')).toBeTruthy();
    const orderTypeTagStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-order-type-conditional:BTC:2').props.style,
    );
    expect(orderTypeTagStyle).toMatchObject({
      backgroundColor: 'red-light-1',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(orderTypeTagStyle.borderColor).toBeUndefined();
    expect(orderTypeTagStyle.borderWidth).toBeUndefined();
    const sellSideTagStyle = StyleSheet.flatten(
      screen.getByTestId('perps-pro-order-side-conditional:BTC:2').props.style,
    );
    expect(sellSideTagStyle).toMatchObject({
      backgroundColor: 'red-light-1',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    expect(sellSideTagStyle.borderColor).toBeUndefined();
    expect(sellSideTagStyle.borderWidth).toBeUndefined();
    expect(screen.getByText('Stop Market').props.style).toMatchObject({
      color: 'red-default',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(screen.getByText('Sell').props.style).toMatchObject({
      color: 'red-default',
      fontSize: 12,
      lineHeight: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-source-conditional:BTC:2').props
          .style,
      ),
    ).toEqual({
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    const sourceTextStyle = StyleSheet.flatten(
      screen.getByText('xyz').props.style,
    );
    expect(sourceTextStyle).toEqual({
      color: 'neutral-foot',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(sourceTextStyle.fontVariant).toBeUndefined();
    expect(screen.queryByText('0%')).toBeNull();
    expect(
      screen.queryByTestId('perps-pro-order-progress-conditional:BTC:2'),
    ).toBeNull();
  });

  it('uses the shared quote unit for Basic Filled and Amount', () => {
    render(
      <PerpsProOpenOrderCard
        amountUnit="quote"
        cancelPending={false}
        onCancel={jest.fn()}
        order={order()}
      />,
    );

    expect(screen.getByText('Filled / Amount (USDC)')).toBeTruthy();
    expect(screen.getByText('100.00 / 200.00')).toBeTruthy();
  });

  it('keeps integer text separate from the unrounded sell progress width', () => {
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        order={order({
          filledRatio: '0.3333333333333333',
          key: 'basic:BTC:4',
          oid: 4,
          side: 'sell',
        })}
      />,
    );

    expect(screen.getByText('33%')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-order-progress-fill-basic:BTC:4').props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'red-default',
      width: '33.33333333333333%',
    });
  });

  it.each([
    ['0', '0%', '0%'],
    ['1', '100%', '100%'],
  ])(
    'renders the Basic %s ratio boundary as %s with a %s track',
    (filledRatio, label, width) => {
      render(
        <PerpsProOpenOrderCard
          cancelPending={false}
          onCancel={jest.fn()}
          order={order({
            filledRatio,
            key: `basic:BTC:${filledRatio}`,
          })}
        />,
      );

      expect(screen.getByText(label)).toBeTruthy();
      expect(
        StyleSheet.flatten(
          screen.getByTestId(
            `perps-pro-order-progress-fill-basic:BTC:${filledRatio}`,
          ).props.style,
        ),
      ).toMatchObject({ width });
    },
  );

  it('shows a dash instead of fabricating zero without a quote reference', () => {
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        order={order({
          category: 'conditional',
          displayAmountQuote: null,
          executionPrice: null,
          executionPriceKind: 'market',
          key: 'conditional:BTC:3',
          oid: 3,
          orderType: 'Stop Market',
          triggerCondition: 'Below',
        })}
      />,
    );

    expect(screen.getByText('Amount (USDC)')).toBeTruthy();
    expect(screen.getByText('-')).toBeTruthy();
    expect(screen.queryByText('0.00')).toBeNull();
  });

  it('only invokes the edit callback for an eligible enabled order', () => {
    const onEdit = jest.fn();
    const { rerender } = render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        editEnabled
        onCancel={jest.fn()}
        onEdit={onEdit}
        order={order()}
      />,
    );

    const priceEdit = screen.getByTestId(
      'perps-pro-order-price-edit-basic:BTC:1',
    );
    expect(priceEdit).toHaveTextContent('100');
    expect(StyleSheet.flatten(priceEdit.props.style)).toMatchObject({
      alignSelf: 'stretch',
      flex: 1,
      justifyContent: 'flex-end',
      marginLeft: 12,
      minWidth: 0,
    });
    expect(priceEdit.props.hitSlop).toEqual({
      bottom: 4,
      left: 0,
      right: 0,
      top: 4,
    });
    expect(
      StyleSheet.flatten(screen.getByText('100').props.style),
    ).toMatchObject({ marginLeft: 0 });
    fireEvent.press(screen.getByText('100'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ oid: 1 }));

    rerender(
      <PerpsProOpenOrderCard
        cancelPending={false}
        editEnabled
        onCancel={jest.fn()}
        onEdit={onEdit}
        order={order({ editKind: null })}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(
      screen.queryByTestId('perps-pro-order-price-edit-basic:BTC:1'),
    ).toBeNull();
  });

  it('keeps the canonical effective price precision without padding market decimals', () => {
    mockMarketIdentity = {
      ...mockReadyMarket,
      displayBase: 'CXMT',
      displayPair: 'CXMTUSDC',
      pxDecimals: 4,
    };
    const onEdit = jest.fn();
    const value = order({
      coin: 'CXMT',
      executionPrice: '12.982',
      key: 'basic:CXMT:12',
      limitPrice: '12.982',
      oid: 12,
    });
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        editEnabled
        onCancel={jest.fn()}
        onEdit={onEdit}
        order={value}
      />,
    );

    expect(screen.getByText('12.982')).toBeTruthy();
    expect(screen.queryByText('12.9820')).toBeNull();
    fireEvent.press(screen.getByText('12.982'));
    expect(onEdit).toHaveBeenCalledWith(value);
    expect(onEdit.mock.calls[0][0].executionPrice).toBe('12.982');
  });

  it('uses the same effective price precision for Conditional Limit orders', () => {
    mockMarketIdentity = {
      ...mockReadyMarket,
      displayBase: 'CXMT',
      displayPair: 'CXMTUSDC',
      pxDecimals: 4,
    };
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        onCancel={jest.fn()}
        order={order({
          category: 'conditional',
          coin: 'CXMT',
          executionPrice: '12.9820',
          key: 'conditional:CXMT:13',
          limitPrice: '12.982',
          oid: 13,
          orderType: 'Stop Limit',
          triggerCondition: 'Below',
        })}
      />,
    );

    expect(screen.getByText('12.982')).toBeTruthy();
    expect(screen.queryByText('12.9820')).toBeNull();
  });

  it('makes the Conditional condition text part of the edit control', () => {
    const onEdit = jest.fn();
    render(
      <PerpsProOpenOrderCard
        cancelPending={false}
        editEnabled
        onCancel={jest.fn()}
        onEdit={onEdit}
        order={order({
          category: 'conditional',
          editKind: 'triggerMarket',
          isTrigger: true,
          limitPrice: '82.8',
          key: 'conditional:BTC:2',
          oid: 2,
          triggerCondition: 'Below',
        })}
      />,
    );

    const conditionsEdit = screen.getByTestId(
      'perps-pro-order-conditions-edit-conditional:BTC:2',
    );
    expect(conditionsEdit).toHaveTextContent('Below');
    fireEvent.press(screen.getByText('Below'));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ oid: 2 }));
  });
});
