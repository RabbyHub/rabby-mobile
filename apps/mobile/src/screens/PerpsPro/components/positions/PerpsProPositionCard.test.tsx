import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

const mockOpenFieldExplanation = jest.fn();
type MockPositionMarket = {
  displayBase: string;
  displayPair: string;
  markPrice: string | null;
  metadataReady: boolean;
  pxDecimals: number | undefined;
  quoteAsset: 'USDC' | 'USDE' | null;
  sourceTag: string | null;
};
const mockReadyMarket: MockPositionMarket = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '105',
  metadataReady: true,
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: 'xyz',
};
let mockPositionMarket: MockPositionMarket = mockReadyMarket;
const mockUsePerpsProPositionMark = jest.fn(() => mockPositionMarket);
const mockEnglishTranslations: Record<string, string> = {
  'page.perps.pro.positions.close': 'Close',
  'page.perps.pro.positions.cross': 'Cross',
  'page.perps.pro.positions.entry': 'Entry Price',
  'page.perps.pro.positions.isolated': 'Isolated',
  'page.perps.pro.positions.leverage': 'Leverage',
  'page.perps.pro.positions.liquidation': 'Liq. Price',
  'page.perps.pro.positions.liquidationDistance': 'Liq. Distance',
  'page.perps.pro.positions.long': 'Long',
  'page.perps.pro.positions.margin': 'Margin',
  'page.perps.pro.positions.manageMargin': 'Manage Margin',
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
};
let mockTranslations = mockEnglishTranslations;

jest.mock('@/assets2024/icons/perps/IconPerpEdit.svg', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return (props: object) => ReactModule.createElement(NativeView, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProAvailableAdd.svg', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return (props: object) => ReactModule.createElement(NativeView, props);
});

jest.mock('@/assets2024/icons/perps/PerpsProPositionUnitSwitch.svg', () => {
  const ReactModule = require('react');
  const { View: NativeView } = require('react-native');
  return (props: object) => ReactModule.createElement(NativeView, props);
});

jest.mock('../common/PerpsProDottedUnderlineText', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    PerpsProDottedUnderlineText: ({
      accessibilityLabel,
      children,
      containerStyle,
      multiline,
      onFirstLineLayout,
      onPress,
      style,
      testID,
    }: any) =>
      onPress
        ? ReactModule.createElement(
            Pressable,
            {
              accessibilityLabel,
              accessibilityRole: 'button',
              onPress,
              style: containerStyle,
              testID,
            },
            ReactModule.createElement(
              Text,
              {
                numberOfLines: multiline ? undefined : 1,
                onTextLayout: (event: any) => {
                  const firstLine = event.nativeEvent.lines[0];
                  if (firstLine) {
                    onFirstLineLayout?.({
                      lineCount: event.nativeEvent.lines.length,
                      width: firstLine.width,
                      x: firstLine.x ?? 0,
                    });
                  }
                },
                style,
              },
              children,
            ),
          )
        : ReactModule.createElement(
            Text,
            { numberOfLines: multiline ? undefined : 1, style, testID },
            children,
          ),
  };
});

jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));

jest.mock('../loading/PerpsProSkeletonBlock', () => ({
  PerpsProSkeletonBlock: require('react-native').View,
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
    t: (key: string) => mockTranslations[key] || key,
  }),
}));

jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => mockUsePerpsProPositionMark(),
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
    mockPositionMarket = mockReadyMarket;
    mockTranslations = mockEnglishTranslations;
    __resetPerpsProPositionSizeUnitSessionForTests();
  });

  it('keeps HIP-3 routing identity out of labels until quote metadata arrives', () => {
    mockPositionMarket = {
      displayBase: 'BTC',
      displayPair: 'BTC',
      markPrice: null,
      metadataReady: false,
      pxDecimals: undefined,
      quoteAsset: null,
      sourceTag: 'hyna',
    };
    const onPressMarket = jest.fn();
    const value = createPosition({ coin: 'hyna:BTC', key: 'hyna:BTC' });
    const view = render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onPressMarket={onPressMarket}
        position={value}
      />,
    );

    expect(screen.queryByText('BTC')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-position-market-hyna:BTC-skeleton'),
    ).toBeTruthy();
    expect(screen.getByText('hyna')).toBeTruthy();
    expect(screen.queryByText('hyna:BTC')).toBeNull();
    expect(screen.getByText('PNL')).toBeTruthy();
    expect(screen.getByText('Size')).toBeTruthy();
    expect(screen.queryByText('PNL (USDC)')).toBeNull();
    fireEvent.press(screen.getByTestId('perps-pro-position-market-hyna:BTC'));
    expect(onPressMarket).toHaveBeenCalledWith('hyna:BTC');

    mockPositionMarket = {
      ...mockReadyMarket,
      displayPair: 'BTCUSDE',
      quoteAsset: 'USDE',
      sourceTag: 'hyna',
    };
    view.rerender(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onPressMarket={onPressMarket}
        position={{ ...value }}
      />,
    );
    expect(screen.getByText('BTCUSDE')).toBeTruthy();
    expect(
      screen.queryByTestId('perps-pro-position-market-hyna:BTC-skeleton'),
    ).toBeNull();
    expect(screen.getByText('PNL (USDE)')).toBeTruthy();
  });

  it('opens the card market and exposes margin management only for Isolated', () => {
    const onManageMargin = jest.fn();
    const onPressMarket = jest.fn();
    const isolated = createPosition();
    const view = render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onManageMargin={onManageMargin}
        onPressMarket={onPressMarket}
        position={isolated}
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-position-market-BTC'));
    expect(onPressMarket).toHaveBeenCalledWith('BTC');
    fireEvent.press(screen.getByTestId('perps-pro-position-manage-margin-BTC'));
    expect(onManageMargin).toHaveBeenCalledWith(isolated);
    expect(
      screen.getByTestId('perps-pro-position-manage-margin-BTC').props.style,
    ).toMatchObject({ height: 16, width: 16 });

    view.rerender(
      <PerpsProPositionCard
        accountIdentity="account-a"
        onManageMargin={onManageMargin}
        onPressMarket={onPressMarket}
        position={createPosition({ marginMode: 'cross' })}
      />,
    );
    expect(
      screen.queryByTestId('perps-pro-position-manage-margin-BTC'),
    ).toBeNull();
  });

  it('matches the approved title tag order and dimensions', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition()}
      />,
    );

    const title = screen.getByTestId('perps-pro-position-title-BTC');
    expect(
      title.props.children.map(
        (child: React.ReactElement) => child.props.testID,
      ),
    ).toEqual([
      'perps-pro-position-side-BTC',
      'perps-pro-position-market-BTC',
      'perps-pro-position-source-BTC',
      'perps-pro-position-mode-BTC',
      'perps-pro-position-direction-BTC',
    ]);
    expect(
      screen.getByTestId('perps-pro-position-side-BTC').props.style,
    ).toMatchObject({ borderRadius: 2, height: 18, width: 16 });
    expect(screen.getByText('B').props.style).toMatchObject({
      fontFamily: 'SF Pro',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    for (const testID of [
      'perps-pro-position-source-BTC',
      'perps-pro-position-mode-BTC',
      'perps-pro-position-direction-BTC',
    ]) {
      expect(screen.getByTestId(testID).props.style).toMatchObject({
        borderRadius: 2,
        borderWidth: 0.5,
        height: 14,
        paddingHorizontal: 4,
      });
    }
    for (const label of ['xyz', 'Isolated', 'Long 20x']) {
      expect(
        StyleSheet.flatten(screen.getByText(label).props.style),
      ).toMatchObject({
        fontFamily: 'SF Pro',
        fontSize: 10,
        fontWeight: '500',
        lineHeight: 12,
      });
    }
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
      ['Margin Ratio', 'marginRatio'],
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
    fireEvent.press(screen.getByLabelText('Liq. Distance'));
    expect(mockOpenFieldExplanation).toHaveBeenLastCalledWith(
      'liquidationDistance',
    );
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
          marginMode: 'isolated',
          marginRatio: null,
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
    expect(
      screen.getByTestId('perps-pro-position-liquidation-distance-label-BTC')
        .props.style,
    ).toMatchObject({ left: 0, position: 'absolute', right: 0, top: 0 });
    expect(
      screen.getByTestId('perps-pro-position-liquidation-label-BTC').props
        .style,
    ).toMatchObject({ left: 0, position: 'absolute', right: 0, top: 0 });
    expect(
      StyleSheet.flatten(screen.getByText('Isolated').props.style),
    ).toEqual(expect.objectContaining({ fontVariant: ['stylistic-six'] }));
    expect(screen.getByText('TP/SL(3)')).toBeTruthy();
    expect(screen.getByText('120.00')).toBeTruthy();
    expect(screen.queryByText('130.00')).toBeNull();
    expect(screen.getByText('90.00')).toBeTruthy();
    expect(screen.queryByText('TP 120.00')).toBeNull();
    expect(
      screen.getByTestId('perps-pro-position-tpsl-values-BTC').props.style.flex,
    ).toBeUndefined();
    expect(
      screen.getByTestId('perps-pro-position-tpsl-edit-BTC').props.style.gap,
    ).toBe(4);
    expect(
      screen.getByRole('button', { name: 'Leverage' }).props.accessibilityState,
    ).toEqual({ disabled: true });
    const leverageAction = screen.getByRole('button', { name: 'Leverage' });
    expect(StyleSheet.flatten(leverageAction.props.style)).toMatchObject({
      borderRadius: 6,
      flex: 1,
      minHeight: 26,
      paddingVertical: 4,
    });
    expect(
      StyleSheet.flatten(leverageAction.props.style).height,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByText('Leverage').props.style),
    ).toMatchObject({ flexShrink: 1, textAlign: 'center' });
    const actions = screen.UNSAFE_getAllByType(View).find(view => {
      const style = StyleSheet.flatten(view.props.style);
      return style?.flexDirection === 'row' && style.gap === 12;
    })!;
    expect(StyleSheet.flatten(actions.props.style)).toMatchObject({
      flexDirection: 'row',
      gap: 12,
    });
  });

  it('gives a long Isolated Liq. Distance the full metric row width', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({
          liquidationPrice: '123456.78',
          marginMode: 'isolated',
        })}
      />,
    );

    expect(screen.getByText('+117477.89%(+123,351.78)')).toBeTruthy();
    expect(
      screen.getByTestId('perps-pro-position-liquidation-distance-BTC').props
        .style,
    ).toMatchObject({ left: 0, right: 0 });
  });

  it('keeps compact geometry for fitting copy and expands only after native measurements collide', () => {
    mockTranslations = {
      ...mockEnglishTranslations,
      'page.perps.pro.positions.entry': 'Precio de entrada',
      'page.perps.pro.positions.leverage': 'Apalancamiento',
      'page.perps.pro.positions.liquidation': 'Precio de liquidación',
      'page.perps.pro.positions.margin': 'Margen',
      'page.perps.pro.positions.marginRatio': 'Ratio de margen',
      'page.perps.pro.positions.mark': 'Precio de marca',
      'page.perps.pro.positions.size': 'Tamaño',
    };
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'cross' })}
      />,
    );

    expect(
      screen.getByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeTruthy();
    expect(
      screen.getByText('Ratio de margen').props.numberOfLines,
    ).toBeUndefined();

    fireEvent(screen.getByTestId('perps-pro-position-metrics-BTC'), 'layout', {
      nativeEvent: { layout: { height: 34, width: 345, x: 0, y: 0 } },
    });
    fireEvent(
      screen.getByTestId('perps-pro-position-middle-metric-BTC'),
      'layout',
      {
        nativeEvent: { layout: { height: 34, width: 116, x: 136, y: 0 } },
      },
    );
    fireEvent(screen.getByText('Margen (USDC)'), 'textLayout', {
      nativeEvent: { lines: [{ width: 72, x: 0 }] },
    });
    fireEvent(screen.getByText('Ratio de margen'), 'textLayout', {
      nativeEvent: {
        lines: [
          { width: 90, x: 0 },
          { width: 50, x: 40 },
        ],
      },
    });

    expect(
      screen.queryByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeNull();
    expect(
      screen.getByText('Ratio de margen').props.numberOfLines,
    ).toBeUndefined();
    expect(
      StyleSheet.flatten(screen.getByLabelText('Ratio de margen').props.style),
    ).toMatchObject({ alignItems: 'flex-end', alignSelf: 'stretch' });
    expect(
      StyleSheet.flatten(screen.getByText('Tamaño (USDC)').props.style),
    ).toMatchObject({ flexShrink: 1, minWidth: 0 });
    expect(
      StyleSheet.flatten(
        screen.getByRole('button', { name: 'Apalancamiento' }).props.style,
      ),
    ).toMatchObject({ minHeight: 26, paddingVertical: 4 });
  });

  it('does not re-render the card when fitting measurements confirm compact mode', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'cross' })}
      />,
    );
    expect(mockUsePerpsProPositionMark).toHaveBeenCalledTimes(1);

    const measureFittingRow = (
      rowTestID: string,
      middleTestID: string,
      middleLabel: string,
      rightLabel: string,
    ) => {
      fireEvent(screen.getByTestId(rowTestID), 'layout', {
        nativeEvent: { layout: { height: 34, width: 345, x: 0, y: 0 } },
      });
      fireEvent(screen.getByTestId(middleTestID), 'layout', {
        nativeEvent: { layout: { height: 34, width: 116, x: 136, y: 0 } },
      });
      fireEvent(screen.getByText(middleLabel), 'textLayout', {
        nativeEvent: { lines: [{ width: 72, x: 0 }] },
      });
      fireEvent(screen.getByText(rightLabel), 'textLayout', {
        nativeEvent: { lines: [{ width: 88, x: 0 }] },
      });
    };

    measureFittingRow(
      'perps-pro-position-metrics-BTC',
      'perps-pro-position-middle-metric-BTC',
      'Margin (USDC)',
      'Margin Ratio',
    );
    measureFittingRow(
      'perps-pro-position-price-metrics-BTC',
      'perps-pro-position-middle-price-BTC',
      'Mark Price (USDC)',
      'Liq. Price (USDC)',
    );

    expect(mockUsePerpsProPositionMark).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeTruthy();
  });

  it('preserves the full-row single-line Liq. Distance value after expanding labels', () => {
    mockTranslations = {
      ...mockEnglishTranslations,
      'page.perps.pro.positions.liquidationDistance':
        'Distancia del precio de liquidación',
    };
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'isolated' })}
      />,
    );

    fireEvent(screen.getByTestId('perps-pro-position-metrics-BTC'), 'layout', {
      nativeEvent: { layout: { height: 34, width: 345, x: 0, y: 0 } },
    });
    fireEvent(
      screen.getByTestId('perps-pro-position-middle-metric-BTC'),
      'layout',
      {
        nativeEvent: { layout: { height: 34, width: 116, x: 136, y: 0 } },
      },
    );
    fireEvent(screen.getByText('Margin (USDC)'), 'textLayout', {
      nativeEvent: { lines: [{ width: 72, x: 0 }] },
    });
    fireEvent(
      screen.getByText('Distancia del precio de liquidación'),
      'textLayout',
      { nativeEvent: { lines: [{ width: 180, x: 0 }] } },
    );

    expect(
      screen.queryByTestId('perps-pro-position-liquidation-distance-label-BTC'),
    ).toBeNull();
    expect(
      screen.getByText('Distancia del precio de liquidación').props
        .numberOfLines,
    ).toBeUndefined();
    expect(screen.getByText('-23.81%(-25.00)').props.numberOfLines).toBe(1);
    expect(
      screen.getByTestId('perps-pro-position-liquidation-distance-BTC').props
        .style,
    ).toMatchObject({ bottom: 0, left: 0, position: 'absolute', right: 0 });
  });

  it('re-evaluates stored natural widths when the card width changes', () => {
    render(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={createPosition({ marginMode: 'cross' })}
      />,
    );

    const measureRow = (
      rowTestID: string,
      middleTestID: string,
      middleLabel: string,
      rightLabel: string,
      rightWidth: number,
    ) => {
      fireEvent(screen.getByTestId(rowTestID), 'layout', {
        nativeEvent: { layout: { height: 34, width: 345, x: 0, y: 0 } },
      });
      fireEvent(screen.getByTestId(middleTestID), 'layout', {
        nativeEvent: { layout: { height: 34, width: 116, x: 136, y: 0 } },
      });
      fireEvent(screen.getByText(middleLabel), 'textLayout', {
        nativeEvent: { lines: [{ width: 72, x: 0 }] },
      });
      fireEvent(screen.getByText(rightLabel), 'textLayout', {
        nativeEvent: { lines: [{ width: rightWidth, x: 0 }] },
      });
    };

    measureRow(
      'perps-pro-position-metrics-BTC',
      'perps-pro-position-middle-metric-BTC',
      'Margin (USDC)',
      'Margin Ratio',
      88,
    );
    measureRow(
      'perps-pro-position-price-metrics-BTC',
      'perps-pro-position-middle-price-BTC',
      'Mark Price (USDC)',
      'Liq. Price (USDC)',
      130,
    );
    expect(
      screen.queryByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeNull();

    fireEvent(
      screen.getByTestId('perps-pro-position-price-metrics-BTC'),
      'layout',
      {
        nativeEvent: { layout: { height: 50, width: 500, x: 0, y: 0 } },
      },
    );

    expect(
      screen.getByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeTruthy();
  });

  it('ignores native layout callbacks from an obsolete measurement key', () => {
    const position = createPosition({ marginMode: 'cross' });
    const view = render(
      <PerpsProPositionCard accountIdentity="account-a" position={position} />,
    );
    const oldRowLayout = screen.getByTestId('perps-pro-position-metrics-BTC')
      .props.onLayout;
    const oldMiddleLayout = screen.getByTestId(
      'perps-pro-position-middle-metric-BTC',
    ).props.onLayout;
    const oldMiddleTextLayout =
      screen.getByText('Margin (USDC)').props.onTextLayout;
    const oldRightTextLayout =
      screen.getByText('Margin Ratio').props.onTextLayout;

    mockTranslations = {
      ...mockEnglishTranslations,
      'page.perps.pro.positions.marginRatio': 'Ratio de margen',
    };
    view.rerender(
      <PerpsProPositionCard
        accountIdentity="account-a"
        position={{ ...position }}
      />,
    );

    act(() => {
      oldRowLayout({
        nativeEvent: { layout: { height: 34, width: 345, x: 0, y: 0 } },
      });
      oldMiddleLayout({
        nativeEvent: { layout: { height: 34, width: 116, x: 136, y: 0 } },
      });
      oldMiddleTextLayout({
        nativeEvent: { lines: [{ width: 72, x: 0 }] },
      });
      oldRightTextLayout({
        nativeEvent: { lines: [{ width: 180, x: 0 }] },
      });
    });

    expect(
      screen.getByTestId('perps-pro-position-liquidation-label-BTC'),
    ).toBeTruthy();
    expect(
      screen.getByText('Ratio de margen').props.numberOfLines,
    ).toBeUndefined();
  });

  it('shows the account margin ratio for Cross', () => {
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
          marginMode: 'cross',
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

  it.each([null, '', '0', '-1', 'not-a-price'])(
    'renders an unavailable liquidation price (%s) with the shared double dash',
    liquidationPrice => {
      render(
        <PerpsProPositionCard
          accountIdentity="account-a"
          position={createPosition({
            liquidationPrice,
            marginMode: 'cross',
          })}
        />,
      );

      expect(screen.getByText('--')).toBeTruthy();
      expect(screen.queryByText('-')).toBeNull();
    },
  );

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

    expect(screen.getByTestId('perps-pro-position-tpsl-edit-BTC')).toBeTruthy();
    fireEvent.press(screen.getByText('TP/SL(1)'));
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
    const position = createPosition({ baseSize: '0.033500' });
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
    expect(
      screen.getByTestId('perps-pro-position-unit-icon-BTC').props,
    ).toMatchObject({
      color: 'neutral-secondary',
      height: 16,
      width: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-BTC').props.style,
      ),
    ).toMatchObject({
      borderBottomColor: 'neutral-bg-5',
      borderBottomWidth: 1,
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
