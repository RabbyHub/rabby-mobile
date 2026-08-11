import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

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
  const { Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({ children, style }: any) =>
      ReactModule.createElement(Text, { style }, children),
  };
});

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
import type {
  PerpsPositionTpslViewModel,
  PerpsPositionViewModel,
} from '../../model/position';

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
  kind: PerpsPositionTpslViewModel['kind'],
  oid: number,
  triggerPrice: string,
): PerpsPositionTpslViewModel => ({
  key: `${kind}-${oid}`,
  kind,
  oid,
  side: 'A',
  timestamp: oid,
  triggerPrice,
});

describe('PerpsProPositionCard', () => {
  beforeEach(() => {
    __resetPerpsProPositionSizeUnitSessionForTests();
  });

  it('shows signed Liq. Distance for Cross and preserves every TP/SL entry', () => {
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
              key: 'tp-1',
              kind: 'takeProfit',
              oid: 1,
              side: 'A',
              timestamp: 3,
              triggerPrice: '120',
            },
            {
              key: 'tp-2',
              kind: 'takeProfit',
              oid: 2,
              side: 'A',
              timestamp: 2,
              triggerPrice: '130',
            },
            {
              key: 'sl-1',
              kind: 'stopLoss',
              oid: 3,
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
    expect(screen.getByText('-23.81%(-25.00)').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 'absolute', right: 0 }),
      ]),
    );
    expect(screen.getByText('TP/SL (3)')).toBeTruthy();
    expect(screen.getByText('120.00, 130.00')).toBeTruthy();
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
    expect(screen.queryByText('TP/SL (0)')).toBeNull();
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

    expect(screen.getByText('TP/SL (1)')).toBeTruthy();
    expect(
      screen.getByText(`${Number(testCase.price).toFixed(2)}`),
    ).toBeTruthy();
    expect(screen.getByText('--').props.style).toMatchObject({
      color: testCase.missingColor,
    });
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
