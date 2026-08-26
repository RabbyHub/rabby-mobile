import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockOpenFieldExplanation = jest.fn();

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
      ({ children }: any, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: jest.fn(),
          present: jest.fn(),
        }));
        return ReactModule.createElement(View, null, children);
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ onPress, testID, title }: any) =>
      ReactModule.createElement(
        Pressable,
        { onPress, testID },
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
  useRegisterBlockingModal: jest.fn(),
}));
jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'page.perps.pro.positionTpsl.confirmPositionTitle':
          'Confirm Position TP/SL',
        'page.perps.pro.positionTpsl.confirmTitle': 'Confirm TP/SL',
        'page.perps.pro.positionTpsl.stopLoss': 'Stop Loss',
        'page.perps.pro.positionTpsl.takeProfit': 'Take Profit',
        'page.perps.pro.positionTpsl.estimatedPnl': 'Estimated PnL',
        'page.perps.pro.positionTpsl.triggerPrice': 'Trigger Price',
        'page.perps.pro.positionTpsl.volume': 'Volume',
        'page.perps.pro.positionTpsl.symbol': 'Symbol',
        'page.perps.pro.positions.entry': 'Entry Price',
        'page.perps.pro.positions.skipLimitConfirmation':
          "Don't display double confirmation for Limit Order again.",
      }[key] || key),
  }),
}));

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsProPositionTpSlReviewState } from '../../scene/usePerpsProPositionTpSl';
import { PerpsProPositionTpSlConfirmationSheet } from './PerpsProPositionTpSlConfirmationSheet';

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
  tpslOrders: [],
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

const review = (
  scope: 'partial' | 'position',
): PerpsProPositionTpSlReviewState => ({
  command: {
    account: { address: '0x1', type: 'hd' as any },
    coin: 'BTC',
    direction: 'long',
    expectedPositionSize: '1',
    legs: [
      {
        kind: 'takeProfit',
        replaceOid: null,
        size: scope === 'partial' ? '0.5' : null,
        triggerPrice: '110',
      },
      {
        kind: 'stopLoss',
        replaceOid: null,
        size: scope === 'partial' ? '0.5' : null,
        triggerPrice: '90',
      },
    ],
    markPrice: '100',
    scope,
    type: 'positionTpSl',
  },
  draft: { legs: [], mode: scope === 'position' ? 'position' : 'add', scope },
  markPrice: '100',
});

describe('PerpsProPositionTpSlConfirmationSheet', () => {
  it('renders and toggles the Figma checkbox on a partial confirmation', () => {
    const onToggleSkipConfirmation = jest.fn();
    render(
      <PerpsProPositionTpSlConfirmationSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={onToggleSkipConfirmation}
        pending={false}
        position={position}
        review={review('partial')}
        skipConfirmation={false}
      />,
    );

    expect(screen.getByText('Confirm TP/SL')).toBeTruthy();
    expect(screen.getByText('Take Profit')).toBeTruthy();
    expect(screen.getByText('Stop Loss')).toBeTruthy();
    expect(screen.getAllByText('Volume')).toHaveLength(2);
    expect(screen.getByText(/Limit Order/)).toBeTruthy();
    fireEvent.press(screen.getAllByLabelText('Estimated PnL')[0]!);
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('estimatedPnl');
    const checkbox = screen.getByTestId(
      'perps-pro-position-tpsl-skip-confirmation',
    );
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(checkbox);
    expect(onToggleSkipConfirmation).toHaveBeenCalledTimes(1);
  });

  it('converts partial volume with the reviewed Mark rather than the trigger', () => {
    render(
      <PerpsProPositionTpSlConfirmationSheet
        amountUnit="quote"
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending={false}
        position={position}
        review={review('partial')}
        skipConfirmation={false}
      />,
    );

    expect(screen.getAllByText('50.00 USDC')).toHaveLength(2);
    expect(screen.queryByText('55.00 USDC')).toBeNull();
    expect(screen.queryByText('45.00 USDC')).toBeNull();
  });

  it('uses the corrected Confirm Position TP/SL content, spacing, and omits partial Volume', () => {
    render(
      <PerpsProPositionTpSlConfirmationSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending={false}
        position={position}
        review={review('position')}
        skipConfirmation={false}
      />,
    );

    expect(screen.getByText('Confirm Position TP/SL')).toBeTruthy();
    expect(screen.queryByText('Volume')).toBeNull();
    expect(screen.getByText(/Limit Order/)).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-confirmation-footer').props
          .style,
      ),
    ).toMatchObject({ paddingBottom: 40, paddingTop: 24 });
  });
});
