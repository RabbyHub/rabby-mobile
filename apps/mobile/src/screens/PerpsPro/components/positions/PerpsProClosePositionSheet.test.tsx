import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockOpenFieldExplanation = jest.fn();
const mockUsePerpsLatestTrade = jest.fn();
const mockSliderHapticComplete = jest.fn();
const mockSliderHapticStart = jest.fn();
const mockSliderHapticValueChange = jest.fn();
const mockUseSliderHaptics = jest.fn();
let mockLatestTradePrice = '60001';
let mockLatestTradeStatus: 'ready' | 'stale' = 'ready';

jest.mock('@/assets2024/icons/perps/icon-switch-mode.svg', () => {
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
          testID: 'close-position-sheet',
        });
      },
    ),
  };
});

jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: ({ disabled, loading, onPress, title, type }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityState: { disabled },
          disabled,
          loading,
          onPress,
          testID: 'close-confirm-button',
          type,
        },
        ReactModule.createElement(Text, null, title),
      ),
  };
});

jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
}));

jest.mock('@/hooks/perps/subscriptions/usePerpsLatestTrade', () => ({
  usePerpsLatestTrade: (options: object) => {
    mockUsePerpsLatestTrade(options);
    return {
      error: null,
      identity: 'BTC',
      status: mockLatestTradeStatus,
      trade: { price: mockLatestTradePrice },
    };
  },
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
  BottomSheetTextInput: require('react-native').TextInput,
  BottomSheetView: require('react-native').View,
}));

jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => ({
    displayBase: 'BTC',
    displayPair: 'BTCUSDC',
    markPrice: '60000',
    pxDecimals: 0,
    quoteAsset: 'USDC',
    sourceTag: null,
  }),
}));

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

jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));

jest.mock('../common/usePerpsProSliderHaptics', () => ({
  usePerpsProSliderHaptics: (options: object) => {
    mockUseSliderHaptics(options);
    return {
      onSlidingComplete: mockSliderHapticComplete,
      onSlidingStart: mockSliderHapticStart,
      onValueChange: mockSliderHapticValueChange,
    };
  },
}));

jest.mock('../common/PerpsProSlider', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProSlider: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'close-position-slider',
      }),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'global.confirm': 'Confirm',
        'page.perps.pro.positions.amount': 'Amount',
        'page.perps.pro.positions.closePosition': 'Close Position',
        'page.perps.pro.positions.entry': 'Entry Price',
        'page.perps.pro.positions.estimatedPnl': 'Estimated PNL',
        'page.perps.pro.positions.limit': 'Limit',
        'page.perps.pro.positions.long': 'Long',
        'page.perps.pro.positions.mark': 'Mark Price',
        'page.perps.pro.positions.market': 'Market',
        'page.perps.pro.positions.marketPrice': 'Market Price',
        'page.perps.pro.positions.positionAmount': 'Position Amount',
        'page.perps.pro.positions.price': 'Price',
      }[key] ?? key),
  }),
}));

import type { PerpsPositionViewModel } from '../../model/position';
import { PerpsProClosePositionSheet } from './PerpsProClosePositionSheet';

const position = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '59000',
  key: 'BTC',
  leverage: 5,
} as PerpsPositionViewModel;
const market = {
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '60000',
  midPrice: '60000',
  pxDecimals: 0,
  quoteAsset: 'USDC',
  sourceTag: 'XYZ',
  szDecimals: 4,
};

describe('PerpsProClosePositionSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLatestTradePrice = '60001';
    mockLatestTradeStatus = 'ready';
  });
  it('uses the 510px sheet, switches the price field to Limit, and seeds latest trade', async () => {
    const onReview = jest.fn();
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={onReview}
        position={position}
        visible
      />,
    );

    expect(screen.getByTestId('close-position-sheet').props.snapPoints).toEqual(
      [510],
    );
    expect(screen.getByTestId('close-position-sheet').props).toMatchObject({
      enableDynamicSizing: false,
      keyboardBehavior: 'interactive',
      keyboardBlurBehavior: 'restore',
    });
    expect(screen.getByTestId('close-confirm-button').props.type).toBe(
      'primary',
    );
    expect(screen.getByText('XYZ')).toBeTruthy();
    expect(screen.getByText('Entry Price (USDC)')).toBeTruthy();
    expect(screen.getByText('Mark Price (USDC)')).toBeTruthy();
    expect(screen.getByDisplayValue('100% (≈1.0000)')).toBeTruthy();
    expect(screen.getByTestId('close-position-slider').props).toMatchObject({
      minimumValue: 0,
      pointCount: 5,
      tone: 'neutral',
      value: 100,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-close-position-footer').props.style,
      ),
    ).toMatchObject({ paddingBottom: 40, paddingTop: 12 });
    for (const testID of [
      'perps-pro-close-position-header',
      'perps-pro-close-position-summary',
    ]) {
      expect(
        StyleSheet.flatten(screen.getByTestId(testID).props.style),
      ).toMatchObject({
        borderBottomColor: 'neutral-bg-5',
        borderBottomWidth: 1,
      });
    }

    fireEvent.press(screen.getByTestId('perps-pro-close-market-price-field'));
    await waitFor(() =>
      expect(screen.getByLabelText('Price').props.value).toBe('60001'),
    );

    fireEvent.press(screen.getByTestId('close-confirm-button'));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        inputSource: 'slider',
        limitPrice: '60001',
        orderType: 'limit',
        percent: 100,
        size: '1',
      }),
    );
  });

  it('omits the source tag for native markets', () => {
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={{ ...market, sourceTag: null }}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );

    expect(screen.getByText('BTCUSDC')).toBeTruthy();
    expect(screen.queryByText('Perp')).toBeNull();
    expect(screen.queryByTestId('perps-pro-close-market-tag')).toBeNull();
  });

  it('switches to independent manual amount input without mutating slider percent', () => {
    const onReview = jest.fn();
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={onReview}
        position={position}
        visible
      />,
    );

    const amount = screen.getByLabelText('Amount');
    expect(amount.props).toMatchObject({
      maxFontSizeMultiplier: 1.2,
      multiline: false,
      numberOfLines: 1,
      scrollEnabled: true,
    });
    expect(amount.props.style).toEqual(
      expect.objectContaining({
        includeFontPadding: false,
        textAlignVertical: 'center',
      }),
    );
    fireEvent(amount, 'focus');
    expect(screen.getByLabelText('Amount').props.selection).toBeUndefined();
    fireEvent(screen.getByTestId('close-position-slider'), 'valueChange', 50);
    expect(screen.getByLabelText('Amount').props.value).toBe('50% (≈0.5000)');
    fireEvent(screen.getByLabelText('Amount'), 'pressIn');
    expect(screen.getByLabelText('Amount').props.value).toBe('');
    expect(screen.getByTestId('close-position-slider').props.value).toBe(0);
    fireEvent.changeText(amount, '0.25');
    expect(screen.getByTestId('close-position-slider').props.value).toBe(0);
    fireEvent.press(screen.getByTestId('close-confirm-button'));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({
        inputSource: 'manual',
        percent: 50,
        size: '0.25',
      }),
    );
  });

  it('wires the percentage slider lifecycle to local step haptics', () => {
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );

    const slider = screen.getByTestId('close-position-slider');
    fireEvent(slider, 'slidingStart', 100);
    fireEvent(slider, 'valueChange', 99);
    fireEvent(slider, 'slidingComplete', 99);

    expect(mockSliderHapticStart).toHaveBeenCalledWith(100);
    expect(mockSliderHapticValueChange).toHaveBeenCalledWith(99);
    expect(mockSliderHapticComplete).toHaveBeenCalledTimes(1);
    expect(mockUseSliderHaptics).toHaveBeenCalledWith({
      disabled: false,
      maximumValue: 100,
      minimumValue: 0,
      step: 1,
      value: expect.any(Number),
    });
  });

  it('clears a focused slider value when Backspace starts manual editing', () => {
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );

    fireEvent(screen.getByLabelText('Amount'), 'focus');
    fireEvent(screen.getByTestId('close-position-slider'), 'valueChange', 50);
    const amount = screen.getByLabelText('Amount');
    fireEvent(amount, 'keyPress', { nativeEvent: { key: 'Backspace' } });
    fireEvent.changeText(amount, '50% (≈0.500)');

    expect(screen.getByLabelText('Amount').props.value).toBe('');
    expect(screen.getByTestId('close-position-slider').props.value).toBe(0);

    fireEvent.changeText(screen.getByLabelText('Amount'), '0.2');
    expect(screen.getByLabelText('Amount').props.value).toBe('0.2');

    fireEvent(screen.getByTestId('close-position-slider'), 'valueChange', 40);
    fireEvent.changeText(screen.getByLabelText('Amount'), '40% (≈0.400)');
    expect(screen.getByLabelText('Amount').props.value).toBe('');
  });

  it('does not clear an existing manual amount on repeated focus or press', () => {
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );

    const amount = screen.getByLabelText('Amount');
    fireEvent(amount, 'focus');
    fireEvent.changeText(amount, '0.25');
    fireEvent(screen.getByLabelText('Amount'), 'pressIn');
    fireEvent(screen.getByLabelText('Amount'), 'focus');

    expect(screen.getByLabelText('Amount').props.value).toBe('0.25');
  });

  it('stays mounted but pauses interaction and realtime work while review covers it', () => {
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        coveredByReview
        market={market}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );

    expect(mockUsePerpsLatestTrade).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByTestId('close-position-sheet').props).toMatchObject({
      backdropProps: { pressBehavior: 'none' },
      enablePanDownToClose: false,
    });
    expect(
      screen.getByTestId('close-confirm-button').props.accessibilityState,
    ).toEqual(expect.objectContaining({ disabled: true }));
    expect(mockUseSliderHaptics).toHaveBeenCalledWith(
      expect.objectContaining({ disabled: true }),
    );
  });

  it('freezes the reviewed Limit price while the confirmation covers the editor', async () => {
    const props = {
      amountUnit: 'base' as const,
      market,
      onClose: jest.fn(),
      onReview: jest.fn(),
      position,
      visible: true,
    };
    const view = render(<PerpsProClosePositionSheet {...props} />);

    fireEvent.press(screen.getByTestId('perps-pro-close-market-price-field'));
    await waitFor(() =>
      expect(screen.getByLabelText('Price').props.value).toBe('60001'),
    );
    fireEvent.press(screen.getByTestId('close-confirm-button'));

    mockLatestTradePrice = '60002';
    view.rerender(<PerpsProClosePositionSheet {...props} coveredByReview />);
    view.rerender(<PerpsProClosePositionSheet {...props} />);

    expect(screen.getByLabelText('Price').props.value).toBe('60001');
  });

  it('does not seed a Limit price from a stale cached latest trade', async () => {
    mockLatestTradeStatus = 'stale';
    const props = {
      amountUnit: 'base' as const,
      market,
      onClose: jest.fn(),
      onReview: jest.fn(),
      position,
      visible: true,
    };
    const view = render(<PerpsProClosePositionSheet {...props} />);

    fireEvent.press(screen.getByTestId('perps-pro-close-market-price-field'));
    expect(screen.getByLabelText('Price').props.value).toBe('');

    mockLatestTradeStatus = 'ready';
    view.rerender(
      <PerpsProClosePositionSheet {...props} market={{ ...market }} />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Price').props.value).toBe('60001'),
    );
  });

  it('opens the Estimated PNL explanation without reviewing the order', () => {
    const onReview = jest.fn();
    render(
      <PerpsProClosePositionSheet
        amountUnit="base"
        market={market}
        onClose={jest.fn()}
        onReview={onReview}
        position={position}
        visible
      />,
    );

    fireEvent.press(screen.getByLabelText('Estimated PNL'));
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('estimatedPnl');
    expect(onReview).not.toHaveBeenCalled();
  });
});
