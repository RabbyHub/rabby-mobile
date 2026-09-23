import { PerpsProCheckboxIcon } from '../common/PerpsProCheckboxIcon';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeColors2024 } from '@/constant/theme';
import { PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE } from '../common/perpsProDialogVisual';

const mockOpenFieldExplanation = jest.fn();
const mockClose = jest.fn();
let mockThemeMode: 'light' | 'dark' | undefined;
beforeEach(() => {
  mockThemeMode = undefined;
});
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));
jest.mock('react-native-linear-gradient', () => require('react-native').View);

jest.mock('@/assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return (props: object) => ReactModule.createElement(View, props);
});

jest.mock(
  '@/components/AutoLockView',
  () => (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'tpsl-confirmation-content',
    }),
);

jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: any, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: mockClose,
          present: jest.fn(),
        }));
        return ReactModule.createElement(
          View,
          { ...props, testID: 'tpsl-confirmation-sheet' },
          ReactModule.createElement(props.backgroundComponent, {
            style: props.backgroundStyle,
            testID: 'tpsl-confirmation-background',
          }),
          props.backdropComponent
            ? ReactModule.createElement(props.backdropComponent, {
                animatedIndex: { value: 0 },
                animatedPosition: { value: 0 },
              })
            : null,
          props.children,
        );
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
  BottomSheetBackdrop: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'tpsl-confirmation-backdrop',
    }),
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

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({
    getStyle,
  }: { getStyle?: (input: object) => object } = {}) => {
    const colors2024 = mockThemeMode
      ? require('@/constant/theme').ThemeColors2024[mockThemeMode]
      : new Proxy({}, { get: (_target, key) => String(key) });
    return {
      colors2024,
      isLight: mockThemeMode !== 'dark',
      styles: getStyle?.({
        colors2024,
        isLight: mockThemeMode !== 'dark',
        safeAreaInsets: { bottom: 0 },
      }),
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
        'page.perps.pro.positionTpsl.skipConfirmation':
          "Don't show this TP/SL confirmation again.",
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
  it('retains the closing confirmation and releases its owner only on native dismissal', () => {
    const props = {
      amountUnit: 'base' as const,
      market,
      position,
      review: review('partial'),
      onClose: jest.fn(),
      onConfirm: jest.fn(),
      onToggleSkipConfirmation: jest.fn(),
      onPresented: jest.fn(),
      onDismissed: jest.fn(),
      pending: false,
      skipConfirmation: false,
    };
    const view = render(<PerpsProPositionTpSlConfirmationSheet {...props} />);
    expect(props.onPresented).toHaveBeenCalledTimes(1);
    view.rerender(
      <PerpsProPositionTpSlConfirmationSheet {...props} review={null} />,
    );
    expect(screen.getByText('Confirm TP/SL')).toBeTruthy();
    expect(mockClose).toHaveBeenCalled();
    expect(props.onDismissed).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-confirm'));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('tpsl-confirmation-sheet').props.enablePanDownToClose,
    ).toBe(false);
    act(() => screen.getByTestId('tpsl-confirmation-sheet').props.onDismiss());
    expect(screen.queryByText('Confirm TP/SL')).toBeNull();
    expect(props.onDismissed).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it.each(['partial', 'position'] as const)(
    'uses signed PNL and frozen size for every %s leg, independently of its kind',
    scope => {
      for (const direction of ['long', 'short'] as const) {
        for (const kind of ['takeProfit', 'stopLoss'] as const) {
          for (const [triggerPrice, expected, color] of [
            [
              direction === 'long' ? '110' : '90',
              '+5.00 USDC',
              'green-default',
            ],
            [direction === 'long' ? '90' : '110', '-5.00 USDC', 'red-default'],
            ['100', '0.00 USDC', 'neutral-title-1'],
            ['', '- USDC', 'neutral-title-1'],
          ]) {
            const frozen = review(scope);
            frozen.command.direction = direction;
            frozen.command.expectedPositionSize = '0.5';
            frozen.command.legs = [
              {
                kind,
                replaceOid: 7,
                size: scope === 'partial' ? '0.5' : null,
                triggerPrice,
              },
            ];
            const view = render(
              <PerpsProPositionTpSlConfirmationSheet
                amountUnit="base"
                market={market}
                onClose={jest.fn()}
                onConfirm={jest.fn()}
                onToggleSkipConfirmation={jest.fn()}
                pending={false}
                position={{ ...position, direction, baseSize: '2' }}
                review={frozen}
                skipConfirmation={false}
              />,
            );
            expect(
              StyleSheet.flatten(screen.getByText(expected!).props.style).color,
            ).toBe(color);
            view.unmount();
          }
        }
      }
    },
  );

  it.each(['light', 'dark'] as const)(
    'renders the real %s surface for both scopes and single or dual legs',
    mode => {
      mockThemeMode = mode;
      const colors = ThemeColors2024[mode];
      for (const scope of ['partial', 'position'] as const) {
        for (const kinds of [
          ['takeProfit'],
          ['stopLoss'],
          ['takeProfit', 'stopLoss'],
        ]) {
          const frozenReview = review(scope);
          frozenReview.command.legs = frozenReview.command.legs.filter(leg =>
            kinds.includes(leg.kind),
          );
          const props = {
            amountUnit: 'base' as const,
            market,
            onClose: jest.fn(),
            onConfirm: jest.fn(),
            onToggleSkipConfirmation: jest.fn(),
            pending: false,
            position,
            review: frozenReview,
            skipConfirmation: false,
          };
          const view = render(
            <PerpsProPositionTpSlConfirmationSheet {...props} />,
          );
          const symbolLabel = screen.getByText('Symbol');
          expect(StyleSheet.flatten(symbolLabel.props.style)).toMatchObject({
            color: colors['neutral-secondary'],
            fontSize: 12,
            lineHeight: 16,
          });
          const symbolRow = screen.UNSAFE_getAllByType(View).find(node => {
            const style = StyleSheet.flatten(node.props.style);
            return (
              style?.flexDirection === 'row' &&
              within(node).queryByText('Symbol')
            );
          })!;
          expect(
            StyleSheet.flatten(
              within(symbolRow).getByText(market.displayPair).props.style,
            ),
          ).toMatchObject({
            color: colors['neutral-title-1'],
            fontSize: 12,
            fontWeight: '500',
            lineHeight: 16,
            textAlign: 'right',
          });
          expect(screen.queryAllByText(/^Volume/)).toHaveLength(
            scope === 'partial' ? kinds.length : 0,
          );
          expect(
            StyleSheet.flatten(
              screen.getByTestId('tpsl-confirmation-background').props.style,
            ),
          ).toMatchObject({
            backgroundColor: colors['neutral-bg-0'],
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
          });
          const sheet = screen.getByTestId('tpsl-confirmation-sheet');
          expect(sheet.props.style).toMatchObject({
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
          });
          expect(sheet.props.handleStyle).toMatchObject({
            backgroundColor: colors['neutral-bg-0'],
            height: 40,
            paddingTop: 10,
            paddingBottom: 24,
          });
          expect(sheet.props.handleIndicatorStyle).toMatchObject({
            backgroundColor: colors['neutral-sheet-handle'],
            width: 50,
            height: 6,
            borderRadius: 3,
          });
          expect(sheet.props.enableDynamicSizing).toBe(true);
          const title = screen.getByText(
            scope === 'partial' ? 'Confirm TP/SL' : 'Confirm Position TP/SL',
          );
          expect(StyleSheet.flatten(title.props.style)).toMatchObject({
            ...PERPS_PRO_DIALOG_HEAVY_TEXT_STYLE,
            fontSize: 20,
            lineHeight: 24,
            textAlign: 'center',
          });
          expect(
            StyleSheet.flatten(
              screen.getByTestId('tpsl-confirmation-content').props.style,
            ),
          ).toMatchObject({
            paddingHorizontal: 16,
            paddingTop: 8,
          });
          expect(
            StyleSheet.flatten(
              screen.getByTestId('perps-pro-position-tpsl-confirmation-footer')
                .props.style,
            ),
          ).toMatchObject({
            paddingHorizontal: 4,
            paddingBottom: 36,
            paddingTop: 24,
          });
          expect(
            screen.getByTestId('tpsl-confirmation-backdrop').props,
          ).toMatchObject({
            opacity: 0.3,
            pressBehavior: 'close',
          });
          view.rerender(
            <PerpsProPositionTpSlConfirmationSheet {...props} pending />,
          );
          expect(
            screen.getByTestId('tpsl-confirmation-backdrop').props
              .pressBehavior,
          ).toBe('none');
          expect(
            screen.getByTestId('tpsl-confirmation-sheet').props
              .enablePanDownToClose,
          ).toBe(false);
          view.rerender(<PerpsProPositionTpSlConfirmationSheet {...props} />);
          expect(
            screen.getByTestId('tpsl-confirmation-backdrop').props
              .pressBehavior,
          ).toBe('close');
          view.unmount();
        }
      }
    },
  );

  it.each([false, true])(
    'renders and toggles the Pro checkbox on a partial confirmation (checked=%s)',
    skipConfirmation => {
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
          skipConfirmation={skipConfirmation}
        />,
      );

      expect(screen.getByText('Confirm TP/SL')).toBeTruthy();
      expect(screen.getByText('Take Profit')).toBeTruthy();
      expect(screen.getByText('Stop Loss')).toBeTruthy();
      expect(screen.getAllByText('Volume (BTC)')).toHaveLength(2);
      expect(screen.getAllByText('0.5(50.00%)')).toHaveLength(2);
      expect(screen.getByText(/TP\/SL confirmation/)).toBeTruthy();
      fireEvent.press(screen.getAllByLabelText('Estimated PnL')[0]!);
      expect(mockOpenFieldExplanation).toHaveBeenCalledWith('estimatedPnl');
      const checkbox = screen.getByTestId(
        'perps-pro-position-tpsl-skip-confirmation',
      );
      expect(StyleSheet.flatten(checkbox.props.style)).toMatchObject({
        justifyContent: 'center',
        marginTop: 8,
        minHeight: 20,
        gap: 4,
      });
      expect(
        StyleSheet.flatten(
          screen.getByText("Don't show this TP/SL confirmation again.").props
            .style,
        ),
      ).toMatchObject({ color: 'neutral-foot', flexShrink: 1 });
      expect(checkbox.props.accessibilityState).toMatchObject({
        checked: skipConfirmation,
      });
      expect(screen.UNSAFE_getByType(PerpsProCheckboxIcon).props).toMatchObject(
        {
          checked: skipConfirmation,
          checkColor: 'neutral-InvertHighlight',
        },
      );
      fireEvent.press(checkbox);
      expect(onToggleSkipConfirmation).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['partial', 'position'] as const)(
    'keeps the selected %s checkbox locked while pending',
    scope => {
      const onToggleSkipConfirmation = jest.fn();
      render(
        <PerpsProPositionTpSlConfirmationSheet
          amountUnit="base"
          market={market}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          onToggleSkipConfirmation={onToggleSkipConfirmation}
          pending
          position={position}
          review={review(scope)}
          skipConfirmation
        />,
      );
      expect(screen.UNSAFE_getByType(PerpsProCheckboxIcon).props.checked).toBe(
        true,
      );
      fireEvent.press(
        screen.getByTestId('perps-pro-position-tpsl-skip-confirmation'),
      );
      expect(onToggleSkipConfirmation).not.toHaveBeenCalled();
    },
  );

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

    expect(screen.getAllByText('Volume (USDC)')).toHaveLength(2);
    expect(screen.getAllByText('50(50.00%)')).toHaveLength(2);
    expect(screen.queryByText('55(50.00%)')).toBeNull();
    expect(screen.queryByText('45(50.00%)')).toBeNull();
  });

  it.each([
    { size: '0.00100', positionSize: '0.002', expected: '0.001(50.00%)' },
    { size: '1', positionSize: '1', expected: '1(100.00%)' },
    { size: '0.33335', positionSize: '1', expected: '0.33335(33.34%)' },
    { size: '1234.56', positionSize: '2469.12', expected: '1,234.56(50.00%)' },
  ])(
    'formats normalized base volume and its own coverage: $expected',
    ({ size, positionSize, expected }) => {
      const frozenReview = review('partial');
      frozenReview.command.expectedPositionSize = positionSize;
      frozenReview.command.legs = [{ ...frozenReview.command.legs[0]!, size }];
      render(
        <PerpsProPositionTpSlConfirmationSheet
          amountUnit="base"
          market={{ ...market, szDecimals: 5 }}
          onClose={jest.fn()}
          onConfirm={jest.fn()}
          onToggleSkipConfirmation={jest.fn()}
          pending={false}
          position={position}
          review={frozenReview}
          skipConfirmation={false}
        />,
      );
      expect(screen.getByText(expected)).toBeTruthy();
      expect(screen.getAllByText('Volume (BTC)')).toHaveLength(1);
    },
  );

  it('keeps each leg coverage and quote value tied to review while the live position changes', () => {
    const frozenReview = review('partial');
    frozenReview.command.legs = frozenReview.command.legs.map((leg, index) => ({
      ...leg,
      size: index === 0 ? '0.12345' : '0.5',
    }));
    const props = {
      amountUnit: 'quote' as const,
      market: { ...market, szDecimals: 5 },
      onClose: jest.fn(),
      onConfirm: jest.fn(),
      onToggleSkipConfirmation: jest.fn(),
      pending: false,
      position,
      review: frozenReview,
      skipConfirmation: false,
    };
    const before = JSON.stringify(frozenReview);
    const view = render(<PerpsProPositionTpSlConfirmationSheet {...props} />);
    expect(screen.getByText('12.35(12.35%)')).toBeTruthy();
    expect(screen.getByText('50(50.00%)')).toBeTruthy();
    view.rerender(
      <PerpsProPositionTpSlConfirmationSheet
        {...props}
        position={{ ...position, baseSize: '2' }}
        market={{ ...props.market, markPrice: '200' }}
      />,
    );
    expect(screen.getByText('12.35(12.35%)')).toBeTruthy();
    expect(screen.getByText('50(50.00%)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-confirm'));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(frozenReview)).toBe(before);
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
    expect(screen.queryByText(/^Volume/)).toBeNull();
    expect(screen.getByText(/TP\/SL confirmation/)).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-confirmation-footer').props
          .style,
      ),
    ).toMatchObject({ paddingBottom: 36, paddingTop: 24 });
  });
});
