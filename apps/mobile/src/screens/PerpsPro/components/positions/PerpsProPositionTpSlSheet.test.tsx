import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockBottomSheetProps = jest.fn();
const mockDismiss = jest.fn();
const mockSheetRegistration = jest.fn();
const mockFormProps = jest.fn();
const mockHeaderProps = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1,
    height: 852,
    scale: 3,
    width: 393,
  }),
}));

jest.mock('@/components/AutoLockView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return ({ children }: any) => ReactModule.createElement(View, null, children);
});

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      ({ children, ...props }: any, ref: React.Ref<unknown>) => {
        mockBottomSheetProps(props);
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          dismiss: mockDismiss,
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, null, children);
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: require('react-native').View,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { percent?: string }) =>
      values?.percent
        ? `${values.percent} Position Size`
        : {
            'global.cancel': 'Cancel',
            'page.perps.pro.positionTpsl.addButton': 'Add TP/SL',
            'page.perps.pro.positionTpsl.addTitle': 'Add TP/SL',
            'page.perps.pro.positionTpsl.estimatedPnl': 'Est. PnL',
            'page.perps.pro.positionTpsl.modify': 'Modify',
            'page.perps.pro.positionTpsl.stopLoss': 'Stop Loss',
            'page.perps.pro.positionTpsl.takeProfit': 'Take Profit',
            'page.perps.pro.positionTpsl.triggerPrice': 'Trigger Price',
            'page.perps.pro.positionTpsl.unfilledAmount': 'Unfilled Amt',
            'page.perps.pro.positions.market': 'Market',
            'page.perps.pro.positions.positionTpsl': 'Position TP/SL',
            'page.perps.pro.positions.price': 'Price',
            'page.perps.pro.positions.tpsl': 'TP/SL',
            'page.perps.pro.positionTpsl.positionSizeCoverage': 'Position Size',
          }[key] || key,
  }),
}));

jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => ({ markPrice: '120' }),
}));

jest.mock('./PerpsProPositionTpSlHeader', () => ({
  PerpsProPositionTpSlHeader: (props: object) => {
    mockHeaderProps(props);
    return null;
  },
  PerpsProPositionTpSlPageHeader: ({ onBack, title }: any) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return ReactModule.createElement(
      Pressable,
      { onPress: onBack, testID: 'perps-pro-position-tpsl-back' },
      ReactModule.createElement(Text, null, title),
    );
  },
}));

jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: (...args: any[]) =>
    mockSheetRegistration(...args),
}));

jest.mock('./PerpsProPositionTpSlForm', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProPositionTpSlForm: (props: {
      minimumHeight: number;
      mode: string;
      presentation: string;
    }) => {
      mockFormProps(props);
      return ReactModule.createElement(View, {
        testID: `tpsl-form-${props.mode}`,
      });
    },
  };
});

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';
import { PerpsProPositionTpSlSheet } from './PerpsProPositionTpSlSheet';

const order = (
  oid: number,
  triggerPrice: string,
  remainingSize: string,
): PerpsPositionTpSlOrderViewModel => ({
  execution: 'market',
  key: `partial:${oid}`,
  kind: 'takeProfit',
  oid,
  originalSize: remainingSize,
  remainingSize,
  scope: 'partial',
  side: 'A',
  timestamp: oid,
  triggerPrice,
});

const position: PerpsPositionViewModel = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '100',
  key: 'BTC',
  leverage: 10,
  liquidationPrice: '80',
  margin: '10',
  marginMode: 'cross',
  marginRatio: null,
  maxLeverage: 50,
  pnl: '0',
  quoteSize: '100',
  roiRatio: '0',
  tpslOrders: [order(1, '110', '0.7'), order(2, '120', '0.8')],
};

const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '100',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: null,
  szDecimals: 3,
};

describe('PerpsProPositionTpSlSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows raw over-100% coverage, Market execution, and long high-to-low order sorting', () => {
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    expect(screen.getByText('150.00% Position Size')).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-tabs').props.style,
      ),
    ).toMatchObject({
      borderBottomColor: 'neutral-bg-5',
      height: 34,
      marginTop: 12,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-add').props.style,
      ),
    ).toMatchObject({ height: 26, paddingHorizontal: 6 });
    expect(screen.getAllByText('Market')).toHaveLength(2);
    expect(screen.queryByText(/Last/)).toBeNull();
    expect(mockBottomSheetProps.mock.lastCall?.[0]).toMatchObject({
      android_keyboardInputMode: 'adjustPan',
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
    });
    expect(
      screen
        .getAllByTestId(/^perps-pro-position-tpsl-order-\d+$/)
        .map(item => item.props.testID),
    ).toEqual([
      'perps-pro-position-tpsl-order-2',
      'perps-pro-position-tpsl-order-1',
    ]);
  });

  it('keeps the right-aligned Unfilled column single-line so long content extends left', () => {
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    const label = screen.getByTestId(
      'perps-pro-position-tpsl-order-2-unfilled-label',
    );
    const value = screen.getByTestId(
      'perps-pro-position-tpsl-order-2-unfilled-value',
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-order-2-unfilled').props
          .style,
      ),
    ).toMatchObject({
      flex: 103,
      flexDirection: 'row',
      height: 36,
      minWidth: 0,
      overflow: 'visible',
      position: 'relative',
    });
    expect(label.props.children).toBe('Unfilled Amt (BTC)');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.ellipsizeMode).toBeUndefined();
    expect(value.props.children).toBe('0.800(80.00%)');
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      flexShrink: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'right',
      top: 0,
    });
    expect(StyleSheet.flatten(value.props.style)).toMatchObject({
      flexShrink: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'right',
      top: 20,
    });
  });

  it('converts Unfilled Amt with Mark when the position unit is quote', () => {
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="quote"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    expect(screen.getByText('96.00(80.00%)')).toBeTruthy();
    expect(screen.getByText('84.00(70.00%)')).toBeTruthy();
    expect(screen.queryByText('80.00(80.00%)')).toBeNull();
  });

  it('routes Add and Position tabs without creating a second sheet', () => {
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
    expect(screen.getByTestId('tpsl-form-add')).toBeTruthy();
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      minimumHeight: 508,
      presentation: 'subpage',
    });
    expect(screen.getByText('Add TP/SL')).toBeTruthy();
    expect(screen.queryByText('Position TP/SL')).toBeNull();
    expect(mockSheetRegistration.mock.lastCall?.[0]).toMatchObject({
      active: true,
      dismissible: true,
      edgeDismissible: true,
    });
    act(() => mockSheetRegistration.mock.lastCall?.[0].dismiss());
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Position TP/SL')).toBeTruthy();
    act(() => mockSheetRegistration.mock.lastCall?.[0].dismiss());
    expect(mockDismiss).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
    fireEvent.press(screen.getByText('Position TP/SL'));
    expect(screen.getByTestId('tpsl-form-position')).toBeTruthy();
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      minimumHeight: 486,
      presentation: 'tab',
    });
  });

  it('returns a successful Add or Modify settlement to the refreshed root list', () => {
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
    expect(screen.getByTestId('tpsl-form-add')).toBeTruthy();

    rerender(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={{
          ...position,
          tpslOrders: [...position.tpslOrders, order(3, '130', '0.25')],
        }}
        settlement={{ revision: 1, scope: 'partial' }}
        visible
      />,
    );

    expect(screen.queryByTestId('tpsl-form-add')).toBeNull();
    expect(screen.getByTestId('perps-pro-position-tpsl-order-3')).toBeTruthy();
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([732]);
  });

  it('uses Figma heights and removes a confirmed canceled item in-place', () => {
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([732]);
    expect(screen.getByTestId('perps-pro-position-tpsl-order-1')).toBeTruthy();

    rerender(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[1]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    expect(screen.queryByTestId('perps-pro-position-tpsl-order-1')).toBeNull();
    expect(screen.getByTestId('perps-pro-position-tpsl-order-2')).toBeTruthy();

    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([718]);
  });

  it('renders the 718px inline form and full position header when the TP/SL tab has no partial orders', () => {
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={{ ...position, tpslOrders: [] }}
        visible
      />,
    );

    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([718]);
    expect(mockHeaderProps.mock.lastCall?.[0]).toMatchObject({
      variant: 'empty',
    });
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      minimumHeight: 482,
      mode: 'add',
      presentation: 'inline-empty',
    });
    expect(screen.queryByTestId('perps-pro-position-tpsl-add')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-tabs').props.style,
      ),
    ).toMatchObject({ marginTop: 16 });
  });

  it('switches from the list to the inline form after the final confirmed cancellation', () => {
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    rerender(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[1, 2]}
        coveredByReview={false}
        defaultTab="partial"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    expect(screen.queryByTestId('perps-pro-position-tpsl-order-1')).toBeNull();
    expect(screen.queryByTestId('perps-pro-position-tpsl-order-2')).toBeNull();
    expect(screen.getByTestId('tpsl-form-add')).toBeTruthy();
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([718]);
  });
});
