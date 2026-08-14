import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockOpenFieldExplanation = jest.fn();

jest.mock('@/assets2024/icons/perps/IconPerpEdit.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('@/assets/icons/swap/switch-cc.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({
      accessibilityLabel,
      children,
      onPress,
      style,
    }: any) =>
      onPress
        ? ReactModule.createElement(
            Pressable,
            { accessibilityLabel, accessibilityRole: 'button', onPress },
            ReactModule.createElement(Text, { style }, children),
          )
        : ReactModule.createElement(Text, { style }, children),
  };
});

jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'page.perps.pro.positions.close': 'Close',
        'page.perps.pro.positions.cross': 'Cross',
        'page.perps.pro.positions.entry': 'Entry Price',
        'page.perps.pro.positions.leverage': 'Leverage',
        'page.perps.pro.positions.liquidation': 'Liq. Price',
        'page.perps.pro.positions.liquidationDistance': 'Liq. Distance',
        'page.perps.pro.positions.long': 'Long',
        'page.perps.pro.positions.margin': 'Margin',
        'page.perps.pro.positions.marginRatio': 'Margin Ratio',
        'page.perps.pro.positions.mark': 'Mark Price',
        'page.perps.pro.positions.pnl': 'PNL',
        'page.perps.pro.positions.positionTpsl': 'Position TP/SL',
        'page.perps.pro.positions.roi': 'ROI',
        'page.perps.pro.positions.size': 'Size',
        'page.perps.pro.positions.stopLossShort': 'SL',
        'page.perps.pro.positions.switchSizeUnit': 'Switch size unit',
        'page.perps.pro.positions.takeProfitShort': 'TP',
        'page.perps.pro.positions.tpsl': 'TP/SL',
        'page.perps.pro.positions.triggerShort': 'Trigger',
      }[key] || key),
  }),
}));

jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => ({
    displayBase: 'BTC',
    displayPair: 'BTCUSDC',
    markPrice: '105',
    pxDecimals: 2,
    quoteAsset: 'USDC',
    sourceTag: 'xyz',
  }),
}));

import { PerpsProPositionCard } from './PerpsProPositionCard';
import { __resetPerpsProPositionSizeUnitSessionForTests } from '../../scene/positionSizeUnitSession';
import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';

const createPosition = (
  overrides: Partial<PerpsPositionViewModel> = {},
): PerpsPositionViewModel => ({
  baseSize: '0.0335',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  key: 'BTC',
  leverage: 20,
  liquidationPrice: '80',
  margin: '4.967826',
  marginMode: 'isolated',
  marginRatio: '0.2',
  maxLeverage: 50,
  pnl: '1',
  quoteSize: '100.02765',
  roiRatio: '0.1',
  tpslOrders: [],
  ...overrides,
});

const triggerOrder = (
  kind: PerpsPositionTpSlOrderViewModel['kind'],
  oid: number,
  triggerPrice: string,
  scope: PerpsPositionTpSlOrderViewModel['scope'] = 'partial',
): PerpsPositionTpSlOrderViewModel => ({
  execution: 'market',
  key: `${kind}-${oid}`,
  kind,
  oid,
  originalSize: '0.01',
  remainingSize: scope === 'position' ? '0' : '0.01',
  scope,
  side: 'A',
  timestamp: oid,
  triggerPrice,
});

describe('PerpsProPositionCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetPerpsProPositionSizeUnitSessionForTests();
  });

  it('maps every position dotted label to its approved explanation', () => {
    const view = render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'cross' })}
      />,
    );

    for (const [label, key] of [
      ['PNL', 'pnl'],
      ['ROI', 'roi'],
      ['Liq. Distance', 'liquidationDistance'],
      ['Liq. Price', 'liquidationPrice'],
    ] as const) {
      fireEvent.press(screen.getByLabelText(label));
      expect(mockOpenFieldExplanation).toHaveBeenLastCalledWith(key);
    }

    view.rerender(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'isolated' })}
      />,
    );
    fireEvent.press(screen.getByLabelText('Margin Ratio'));
    expect(mockOpenFieldExplanation).toHaveBeenLastCalledWith('marginRatio');
  });

  it('shows signed Liq. Distance and the nearest partial TP/SL to Mark', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={{
          baseSize: '2',
          coin: 'BTC',
          direction: 'long',
          entryPrice: '100',
          key: 'BTC',
          leverage: 40,
          liquidationPrice: '80',
          margin: '5',
          marginMode: 'cross',
          marginRatio: '0.025',
          maxLeverage: 50,
          pnl: '10',
          quoteSize: '200',
          roiRatio: '0.2',
          tpslOrders: [
            {
              execution: 'market',
              key: 'tp-1',
              kind: 'takeProfit',
              oid: 1,
              originalSize: '1',
              remainingSize: '1',
              scope: 'partial',
              side: 'A',
              timestamp: 3,
              triggerPrice: '120',
            },
            {
              execution: 'market',
              key: 'tp-2',
              kind: 'takeProfit',
              oid: 2,
              originalSize: '1',
              remainingSize: '1',
              scope: 'partial',
              side: 'A',
              timestamp: 2,
              triggerPrice: '130',
            },
            {
              execution: 'market',
              key: 'sl-1',
              kind: 'stopLoss',
              oid: 3,
              originalSize: '1',
              remainingSize: '1',
              scope: 'partial',
              side: 'A',
              timestamp: 1,
              triggerPrice: '90',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.queryByText('Margin Ratio')).toBeNull();
    expect(screen.queryByText('2.50%')).toBeNull();
    expect(screen.getByText('Liq. Distance')).toBeTruthy();
    expect(screen.getByText('-23.81%(-25.00)').props).toMatchObject({
      numberOfLines: 1,
    });
    expect(
      screen.getByTestId('perps-pro-position-liquidation-distance-BTC').props
        .style,
    ).toMatchObject({
      alignItems: 'flex-end',
      bottom: 0,
      left: 0,
      position: 'absolute',
      right: 0,
    });
    expect(screen.getByText('TP/SL(3)')).toBeTruthy();
    expect(screen.getByText('120.00')).toBeTruthy();
    expect(screen.queryByText('130.00')).toBeNull();
    expect(screen.getByText('90.00')).toBeTruthy();
    expect(screen.queryByText('TP 120.00')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-position-tpsl-values-BTC').props.style.flex,
    ).toBeUndefined();
    expect(
      screen.getByTestId('perps-pro-position-tpsl-BTC').props.style.gap,
    ).toBe(4);
    expect(
      screen.getByRole('button', { name: 'Leverage' }).props.accessibilityState,
    ).toEqual({ disabled: true });
  });

  it('gives a long Cross Liq. Distance the full metric row width', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({
          liquidationPrice: '123456.78',
          marginMode: 'cross',
        })}
      />,
    );

    expect(screen.getByText('+117477.89%(+123,351.78)')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-position-liquidation-distance-BTC').props
        .style,
    ).toMatchObject({ left: 0, right: 0 });
  });

  it('shows the current maintenance risk ratio for Isolated', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={{
          baseSize: '0.0335',
          coin: 'BTC',
          direction: 'long',
          entryPrice: '100',
          key: 'BTC',
          leverage: 20,
          liquidationPrice: '80',
          margin: '4.967826',
          marginMode: 'isolated',
          marginRatio: '0.20135095311309212521',
          maxLeverage: 50,
          pnl: '-0.0134',
          quoteSize: '100.02765',
          roiRatio: '-0.0026789',
          tpslOrders: [],
        }}
      />,
    );

    expect(screen.getByText('Margin Ratio')).toBeTruthy();
    expect(screen.getByText('20.14%')).toBeTruthy();
    expect(screen.queryByText('Liq. Distance')).toBeNull();
    expect(screen.queryByText('TP/SL(0)')).toBeNull();
  });

  it.each([
    {
      kind: 'takeProfit' as const,
      missingColor: 'red-default',
      name: 'TP only',
      price: '120',
    },
    {
      kind: 'stopLoss' as const,
      missingColor: 'green-default',
      name: 'SL only',
      price: '90',
    },
  ])('renders the approved one-sided layout for $name', testCase => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({
          tpslOrders: [triggerOrder(testCase.kind, 1, testCase.price)],
        })}
      />,
    );

    expect(screen.getByText('TP/SL(1)')).toBeTruthy();
    expect(
      screen.getByText(`${Number(testCase.price).toFixed(2)}`),
    ).toBeTruthy();
    expect(screen.getByText('--').props.style).toMatchObject({
      color: testCase.missingColor,
    });
  });

  it('routes a partial-only card edit and the bottom action to TP/SL', () => {
    const onEditTpSl = jest.fn();
    const value = createPosition({
      tpslOrders: [triggerOrder('takeProfit', 1, '120')],
    });
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onEditTpSl={onEditTpSl}
        position={value}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-edit-BTC'));
    expect(onEditTpSl).toHaveBeenLastCalledWith(value, 'partial');
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-action-BTC'));
    expect(onEditTpSl).toHaveBeenLastCalledWith(value, 'partial');
  });

  it('routes the bottom action to TP/SL when the card has no orders', () => {
    const onEditTpSl = jest.fn();
    const value = createPosition({ tpslOrders: [] });
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onEditTpSl={onEditTpSl}
        position={value}
      />,
    );

    expect(screen.queryByTestId('perps-pro-position-tpsl-edit-BTC')).toBeNull();
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-action-BTC'));
    expect(onEditTpSl).toHaveBeenCalledWith(value, 'partial');
  });

  it('shows Position TP/SL prices and only the partial count for mixed orders', () => {
    const onEditTpSl = jest.fn();
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onEditTpSl={onEditTpSl}
        position={createPosition({
          tpslOrders: [
            triggerOrder('takeProfit', 1, '120', 'position'),
            triggerOrder('stopLoss', 2, '90', 'position'),
            triggerOrder('takeProfit', 3, '115'),
            triggerOrder('stopLoss', 4, '95'),
          ],
        })}
      />,
    );

    expect(screen.getByText('Position TP/SL')).toBeTruthy();
    expect(screen.getByText('TP/SL(2)')).toBeTruthy();
    expect(screen.getByText('120.00')).toBeTruthy();
    expect(screen.getByText('90.00')).toBeTruthy();
    expect(screen.queryByText('115.00')).toBeNull();
    fireEvent.press(screen.getByLabelText('TP/SL'));
    expect(onEditTpSl).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'BTC' }),
      'position',
    );
  });

  it('remembers each position unit only for the current app process', () => {
    const position = createPosition();
    const first = render(
      <PerpsProPositionCard accountIdentity="account-a" position={position} />,
    );

    expect(screen.getByText('Size (USDC)')).toBeTruthy();
    expect(screen.getByText('100.03')).toBeTruthy();
    const unitControl = screen.getByTestId('perps-pro-position-unit-BTC');
    expect(unitControl.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityValue: { text: 'USDC' },
      hitSlop: { bottom: 14, left: 4, right: 4, top: 14 },
    });
    fireEvent.press(screen.getByText('Size (USDC)'));
    expect(screen.getByText('Size (BTC)')).toBeTruthy();
    expect(screen.getByText('0.0335')).toBeTruthy();
    expect(screen.getByText('4.97')).toBeTruthy();

    first.unmount();
    const second = render(
      <PerpsProPositionCard accountIdentity="account-a" position={position} />,
    );
    expect(screen.getByText('Size (BTC)')).toBeTruthy();

    second.unmount();
    render(
      <PerpsProPositionCard accountIdentity="account-b" position={position} />,
    );
    expect(screen.getByText('Size (USDC)')).toBeTruthy();
  });
});
