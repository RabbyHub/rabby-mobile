import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

const mockModalProps = jest.fn();
const mockPresent = jest.fn();
const mockClose = jest.fn();
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
  return {
    __esModule: true,
    default: (props: object) => ReactModule.createElement(View, props),
  };
});
jest.mock('@/components/customized/BottomSheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    AppBottomSheetModal: ReactModule.forwardRef(
      (props: any, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          close: mockClose,
          present: mockPresent,
        }));
        mockModalProps(props);
        return ReactModule.createElement(
          View,
          { testID: 'bottom-sheet' },
          props.children,
        );
      },
    ),
  };
});
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  TextInput: require('react-native').TextInput,
}));
jest.mock('@/components2024/Button', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Button: (props: any) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          disabled: props.disabled,
          onPress: props.onPress,
          testID: props.testID,
        },
        ReactModule.createElement(Text, null, props.title),
      ),
  };
});
jest.mock('@/components2024/GlobalBottomSheetModal/utils-help', () => ({
  makeBottomSheetProps: () => ({}),
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
jest.mock('@/utils/modalGate', () => ({ useRegisterBlockingModal: jest.fn() }));
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { TextInput, View } = require('react-native');
  return {
    BottomSheetTextInput: ReactModule.forwardRef(
      (props: object, ref: unknown) =>
        ReactModule.createElement(TextInput, { ...props, ref }),
    ),
    BottomSheetView: (props: object) => ReactModule.createElement(View, props),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../common/perpsProSheetNavigationRegistry', () => ({
  usePerpsProSheetNavigationRegistration: jest.fn(),
}));
jest.mock('../common/usePerpsProDismissKeyboard', () => ({
  usePerpsProDismissKeyboard: () => (action: () => void) => action(),
}));
jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));
jest.mock('../common/usePerpsProSliderHaptics', () => ({
  usePerpsProSliderHaptics: () => ({
    onSlidingComplete: jest.fn(),
    onSlidingStart: jest.fn(),
    onValueChange: jest.fn(),
  }),
}));
jest.mock('../common/PerpsProSlider', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProSlider: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'perps-pro-slider',
      }),
  };
});
jest.mock('../../scene/usePerpsProPositionMark', () => ({
  usePerpsProPositionMark: () => ({ markPrice: '100' }),
}));

import type { PerpsOpenOrderViewModel } from '../../model/openOrder';
import type { PerpsPositionViewModel } from '../../model/position';
import type {
  PerpsProOpenOrderEditEditorState,
  PerpsProOpenOrderEditReviewState,
} from '../../scene/usePerpsProOpenOrderEdit';
import { PerpsProBasicOrderEditSheet } from './PerpsProBasicOrderEditSheet';
import { PerpsProConditionalOrderEditSheet } from './PerpsProConditionalOrderEditSheet';
import { PerpsProOpenOrderEditConfirmationSheet } from './PerpsProOpenOrderEditConfirmationSheet';

const order = (
  overrides: Partial<PerpsOpenOrderViewModel> = {},
): PerpsOpenOrderViewModel => ({
  amountBase: '1',
  amountQuote: '100',
  category: 'basic',
  cloid: null,
  coin: 'BTC',
  displayAmountQuote: '100',
  editKind: 'limit',
  executionPrice: '100',
  executionPriceKind: 'limit',
  filledQuote: '50',
  filledRatio: '0.5',
  filledSize: '0.5',
  hasChildren: false,
  isPositionTpsl: false,
  isTopLevel: true,
  isTrigger: false,
  limitPrice: '100',
  key: 'basic:BTC:1',
  oid: 1,
  orderType: 'Limit',
  reduceOnly: false,
  remainingSize: '0.5',
  side: 'buy',
  tif: 'Gtc',
  timestamp: 1,
  triggerCondition: null,
  triggerKind: null,
  triggerPrice: null,
  ...overrides,
});

const position = {
  baseSize: '1',
  coin: 'BTC',
  direction: 'long',
  entryPrice: '90',
  key: 'BTC',
  tpslOrders: [],
} as PerpsPositionViewModel;

const market = {
  dexId: '',
  displayBase: 'BTC',
  displayPair: 'BTCUSDC',
  markPrice: '100',
  marketKey: 'hyperliquid::BTC',
  pxDecimals: 2,
  quoteAsset: 'USDC',
  sourceTag: 'xyz',
  szDecimals: 3,
};

const basicEditor = {
  account: { address: '0x1', type: 'watch' },
  amountUnit: 'quote',
  category: 'basic',
  market,
  order: order(),
} as Extract<PerpsProOpenOrderEditEditorState, { category: 'basic' }>;

const conditionalEditor = {
  ...basicEditor,
  category: 'conditional',
  order: order({
    category: 'conditional',
    editKind: 'triggerMarket',
    executionPrice: null,
    executionPriceKind: 'market',
    isTrigger: true,
    limitPrice: '101.2',
    orderType: 'Take Profit Market',
    reduceOnly: true,
    side: 'sell',
    triggerKind: 'takeProfit',
    triggerPrice: '110',
  }),
  position,
} as Extract<PerpsProOpenOrderEditEditorState, { category: 'conditional' }>;

describe('Perps Pro open order edit sheets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('locks the Basic editor to the 326px Figma geometry and remaining sz', () => {
    render(
      <PerpsProBasicOrderEditSheet
        coveredByReview={false}
        editor={basicEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        visible
      />,
    );
    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        android_keyboardInputMode: 'adjustPan',
        enablePanDownToClose: true,
        keyboardBehavior: 'interactive',
        keyboardBlurBehavior: 'restore',
        snapPoints: [326],
      }),
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-basic-order-edit-content').props.style,
      ),
    ).toMatchObject({ height: 286, paddingHorizontal: 15, paddingTop: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-basic-order-edit-footer').props.style,
      ),
    ).toMatchObject({ left: 15, right: 15, top: 210 });
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.amount').props.value,
    ).toBe('50.00');
    const source = screen.getByText('xyz');
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-source').props.style,
      ),
    ).toEqual({
      alignItems: 'center',
      backgroundColor: 'neutral-bg-5',
      borderRadius: 4,
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 1,
    });
    const sourceTextStyle = StyleSheet.flatten(source.props.style);
    expect(sourceTextStyle).toEqual({
      color: 'neutral-foot',
      fontFamily: 'SF Pro Rounded',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(sourceTextStyle.fontVariant).toBeUndefined();
    for (const testID of [
      'perps-pro-open-order-edit-order-type-tag',
      'perps-pro-open-order-edit-side-tag',
    ]) {
      const tagStyle = StyleSheet.flatten(
        screen.getByTestId(testID).props.style,
      );
      expect(tagStyle).toMatchObject({
        backgroundColor: 'green-light-1',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 1,
      });
      expect(tagStyle.borderColor).toBeUndefined();
      expect(tagStyle.borderWidth).toBeUndefined();
    }
    expect(screen.getByText('Limit').props.style).toMatchObject({
      color: 'green-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(
      screen.getByText('page.perps.pro.openOrders.buy').props.style,
    ).toMatchObject({
      color: 'green-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
  });

  it('keeps the Basic Bottom Sheet inputs under native cursor ownership', () => {
    render(
      <PerpsProBasicOrderEditSheet
        coveredByReview={false}
        editor={basicEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        visible
      />,
    );
    const priceInput = screen.getByLabelText('page.perps.pro.openOrders.price');

    expect(priceInput.props.selection).toBeUndefined();
    fireEvent(priceInput, 'focus', { nativeEvent: {} });
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.selection,
    ).toBeUndefined();

    fireEvent.changeText(priceInput, '1001');
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.value,
    ).toBe('1001');
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.selection,
    ).toBeUndefined();

    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.price'),
      '0000',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.value,
    ).toBe('0000');
    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.price'),
      '50000',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.value,
    ).toBe('50000');

    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.price'),
      '100',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.value,
    ).toBe('100');
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.selection,
    ).toBeUndefined();
  });

  it('keeps Price independent while reprojecting only an untouched quote Amount', () => {
    render(
      <PerpsProBasicOrderEditSheet
        coveredByReview={false}
        editor={basicEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        visible
      />,
    );

    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.price'),
      '120',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.amount').props.value,
    ).toBe('60.00');

    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.amount'),
      '55',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.price').props.value,
    ).toBe('120');
    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.price'),
      '130',
    );
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.amount').props.value,
    ).toBe('55');
  });

  it('locks the Conditional editor to 542px with the exact remaining coverage', () => {
    render(
      <PerpsProConditionalOrderEditSheet
        coveredByReview={false}
        editor={conditionalEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );
    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ snapPoints: [542] }),
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-conditional-order-edit-content').props
          .style,
      ),
    ).toMatchObject({ height: 502, paddingHorizontal: 15, paddingTop: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-conditional-order-edit-footer').props
          .style,
      ),
    ).toMatchObject({ top: 426 });
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.amount').props.value,
    ).toBe('100% (≈50.00)');
    for (const testID of [
      'perps-pro-open-order-edit-order-type-tag',
      'perps-pro-open-order-edit-side-tag',
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
    expect(screen.getByText('Take Profit Market').props.style).toMatchObject({
      color: 'red-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    expect(
      screen.getByText('page.perps.pro.openOrders.sell').props.style,
    ).toMatchObject({
      color: 'red-default',
      fontSize: 12,
      fontWeight: '500',
      lineHeight: 16,
    });
    fireEvent.press(
      screen.getByLabelText('page.perps.pro.openOrders.estimatedPnl'),
    );
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('estimatedPnl');
  });

  it('keeps a Conditional draft when the live position changes', () => {
    const { rerender } = render(
      <PerpsProConditionalOrderEditSheet
        coveredByReview={false}
        editor={conditionalEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );
    fireEvent.changeText(
      screen.getByLabelText('page.perps.pro.openOrders.triggerPrice'),
      '115',
    );
    const amountInput = screen.getByLabelText(
      'page.perps.pro.openOrders.amount',
    );
    fireEvent(amountInput, 'focus');
    fireEvent.changeText(amountInput, '20');

    rerender(
      <PerpsProConditionalOrderEditSheet
        coveredByReview={false}
        editor={conditionalEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={{ ...position, baseSize: '0.8' }}
        visible
      />,
    );

    expect(
      screen.getByLabelText('page.perps.pro.openOrders.triggerPrice').props
        .value,
    ).toBe('115');
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.amount').props.value,
    ).toBe('20');
  });

  it('locks Confirm immediately during review construction without dimming or replacing the Conditional slider', () => {
    render(
      <PerpsProConditionalOrderEditSheet
        coveredByReview={false}
        editor={conditionalEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        reviewRequesting
        visible
      />,
    );

    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backdropProps: { pressBehavior: 'none' },
        enablePanDownToClose: false,
      }),
    );
    expect(
      screen.getByTestId('perps-pro-conditional-order-edit-confirm').props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(screen.getByTestId('perps-pro-slider').props).toMatchObject({
      dimWhenDisabled: false,
      disabled: true,
      value: 100,
    });
    expect(
      screen.getByLabelText('page.perps.pro.openOrders.triggerPrice').props
        .value,
    ).toBe('110');
  });

  it('renders Conditional Limit with editable Trigger and Limit prices', () => {
    const onReview = jest.fn();
    render(
      <PerpsProConditionalOrderEditSheet
        coveredByReview={false}
        editor={{
          ...conditionalEditor,
          order: order({
            ...conditionalEditor.order,
            editKind: 'triggerLimit',
            executionPrice: '105',
            executionPriceKind: 'limit',
            limitPrice: '105',
            orderType: 'Take Profit Limit',
          }),
        }}
        onClose={jest.fn()}
        onReview={onReview}
        position={null}
        visible
      />,
    );

    expect(
      screen.getByLabelText('page.perps.pro.openOrders.triggerPrice').props
        .value,
    ).toBe('110');
    const limitInput = screen.getByLabelText(
      'page.perps.pro.openOrders.limitPrice',
    );
    expect(limitInput.props.value).toBe('105');
    fireEvent.changeText(limitInput, '106');
    fireEvent.press(
      screen.getByTestId('perps-pro-conditional-order-edit-confirm'),
    );
    expect(onReview).toHaveBeenCalledWith({
      baseSize: '0.5',
      limitPrice: '106',
      triggerPrice: '110',
    });
    expect(screen.getAllByText('--')).toHaveLength(3);
  });

  it('covers the editor with a 302px Basic confirmation and retained checkbox', () => {
    const onToggle = jest.fn();
    const review = {
      category: 'basic',
      command: {
        account: basicEditor.account,
        coin: 'BTC',
        dexId: '',
        expected: {
          limitPrice: '100',
          reduceOnly: false,
          remainingSize: '0.5',
          side: 'buy',
          tif: 'Gtc',
        },
        marketKey: 'hyperliquid::BTC',
        oid: 1,
        replacement: { baseSize: '0.4', limitPrice: '110' },
        type: 'modifyOpenOrder',
      },
    } as PerpsProOpenOrderEditReviewState;
    render(
      <PerpsProOpenOrderEditConfirmationSheet
        editor={basicEditor}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={onToggle}
        pending={false}
        review={review}
        skipConfirmation={false}
      />,
    );
    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ snapPoints: [302] }),
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-confirmation-content')
          .props.style,
      ),
    ).toMatchObject({ height: 262, paddingHorizontal: 15, paddingTop: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-confirmation-footer')
          .props.style,
      ),
    ).toMatchObject({ top: 186 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-side-tag').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'green-light-1', borderRadius: 4 });
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox.props.accessibilityState).toMatchObject({ checked: false });
    fireEvent.press(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('keeps the root sheet mounted and non-dismissible under the 326px Conditional confirmation', () => {
    const { unmount } = render(
      <PerpsProConditionalOrderEditSheet
        coveredByReview
        editor={conditionalEditor}
        onClose={jest.fn()}
        onReview={jest.fn()}
        position={position}
        visible
      />,
    );
    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        backdropProps: { pressBehavior: 'none' },
        enablePanDownToClose: false,
        snapPoints: [542],
      }),
    );
    expect(
      screen.getByTestId('perps-pro-conditional-order-edit-confirm').props
        .accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(screen.getByTestId('perps-pro-slider').props).toMatchObject({
      dimWhenDisabled: false,
      disabled: true,
    });
    unmount();

    const review = {
      category: 'conditional',
      command: {
        account: conditionalEditor.account,
        coin: 'BTC',
        dexId: '',
        expected: {},
        marketKey: 'hyperliquid::BTC',
        oid: 2,
        replacement: {
          baseSize: '0.4',
          limitPrice: '103.04',
          orderType: {
            trigger: { isMarket: true, tpsl: 'tp', triggerPx: '112' },
          },
          triggerPrice: '112',
        },
        type: 'modifyOpenOrder',
      },
      referencePrice: '100',
    } as PerpsProOpenOrderEditReviewState;
    render(
      <PerpsProOpenOrderEditConfirmationSheet
        editor={conditionalEditor}
        onClose={jest.fn()}
        onConfirm={jest.fn()}
        onToggleSkipConfirmation={jest.fn()}
        pending={false}
        review={review}
        skipConfirmation={false}
      />,
    );
    expect(mockModalProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ snapPoints: [326] }),
    );
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-confirmation-footer')
          .props.style,
      ),
    ).toMatchObject({ top: 210 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-open-order-edit-side-tag').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'red-light-1', borderRadius: 4 });
  });
});
