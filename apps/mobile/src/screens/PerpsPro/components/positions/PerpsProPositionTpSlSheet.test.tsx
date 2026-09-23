import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import React from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
} from 'react-native';
import { perpsProKeyboardSession } from '../common/perpsProKeyboardSession';
import { ThemeColors2024 } from '@/constant/theme';

let mockAndroid = false;
let mockThemeMode: 'light' | 'dark' | undefined;
jest.mock('@/core/apis/autoLock', () => ({ uiRefreshTimeout: jest.fn() }));
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockAndroid;
  },
}));

const mockBottomSheetProps = jest.fn();
const mockDismiss = jest.fn();
const mockSheetRegistration = jest.fn();
const mockFormProps = jest.fn();
const mockHeaderProps = jest.fn();
const mockOpenFieldExplanation = jest.fn();
const mockScrollToEnd = jest.fn();
const mockScrollTo = jest.fn();
const mockSnapToIndex = jest.fn();
const mockKeyboardListeners = new Map<string, () => void>();
let mockAnimationFrameCallback: FrameRequestCallback | null = null;
let mockNextFormInstanceId = 0;
let mockAnimatedReactions: Array<{
  prepare: () => unknown;
  react: (value: any) => void;
}> = [];

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  return {
    default: { View: require('react-native').View },
    __esModule: true,
    useAnimatedStyle: (fn: () => unknown) => fn(),
    runOnJS: (callback: (...args: unknown[]) => unknown) => callback,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (value: any) => void,
    ) => {
      mockAnimatedReactions.push({ prepare, react });
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
  };
});

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
          snapToIndex: mockSnapToIndex,
          present: jest.fn(),
        }));
        return ReactModule.createElement(
          View,
          null,
          ReactModule.createElement(props.backgroundComponent, {
            style: props.backgroundStyle,
            testID: 'tpsl-background',
          }),
          props.backdropComponent
            ? ReactModule.createElement(props.backdropComponent, {
                animatedIndex: { value: 0 },
                animatedPosition: { value: 0 },
              })
            : null,
          children,
        );
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    BottomSheetBackdrop: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'tpsl-backdrop',
      }),
    ANIMATION_STATUS: { STOPPED: 2 },
    SCROLLABLE_STATUS: { UNLOCKED: 1 },
    useBottomSheetInternal: () => ({
      animatedAnimationState: { value: { status: 2 } },
      animatedScrollableStatus: { value: 1 },
      animatedPosition: { value: 94 },
      animatedSheetHeight: {
        value: mockBottomSheetProps.mock.lastCall?.[0].snapPoints[0],
      },
      animatedDetentsState: { value: { detents: [94] } },
    }),
    BottomSheetScrollView: ReactModule.forwardRef(
      ({ children, ...props }: any, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          scrollToEnd: mockScrollToEnd,
          scrollTo: mockScrollTo,
        }));

        return ReactModule.createElement(
          View,
          { ...props, testID: 'tpsl-scroll' },
          children,
        );
      },
    ),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, left: 0, right: 0, top: 47 }),
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { percent?: string }) =>
      values?.percent
        ? `${values.percent} Position Size`
        : {
            'global.cancel': 'Cancel',
            'global.addButton': 'Add',
            'page.perps.pro.marketSelector.all': 'All',
            'page.perps.pro.positionTpsl.addButton': 'Add TP/SL',
            'page.perps.pro.positionTpsl.addTitle': 'Add TP/SL',
            'page.perps.pro.positionTpsl.estimatedPnlShort': 'Est. PnL',
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
jest.mock('../common/PerpsProFieldExplanationContext', () => ({
  usePerpsProFieldExplanation: () => mockOpenFieldExplanation,
}));

jest.mock('./PerpsProPositionTpSlForm', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsProPositionTpSlForm: (props: any) => {
      const [instanceId] = ReactModule.useState(() => ++mockNextFormInstanceId);
      const sheetId = ReactModule.useContext(
        require('../common/PerpsProKeyboardSheetContext')
          .PerpsProKeyboardSheetContext,
      );
      mockFormProps({ ...props, instanceId, sheetId });
      return ReactModule.createElement(View, {
        testID: `tpsl-form-${props.mode}`,
      });
    },
  };
});

import type { PerpsPositionViewModel } from '../../model/position';
import type { PerpsPositionTpSlOrderViewModel } from '../../model/positionTpSl';
import { PerpsProPositionTpSlOrderList } from './PerpsProPositionTpSlOrderList';
import { PerpsProPositionTpSlSheet } from './PerpsProPositionTpSlSheet';

const order = (
  oid: number,
  triggerPrice: string,
  remainingSize: string,
  scope: PerpsPositionTpSlOrderViewModel['scope'] = 'partial',
): PerpsPositionTpSlOrderViewModel => ({
  execution: 'market',
  key: `${scope}:${oid}`,
  kind: 'takeProfit',
  oid,
  originalSize: remainingSize,
  remainingSize,
  scope,
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
  it.each(['partial', 'position'] as const)(
    'keeps %s cancel loading local to its OID and retains the list button color',
    scope => {
      const first = order(1, '110', '0.5', scope);
      const second = order(2, '120', '0.5', scope);
      const onCancelOrder = jest.fn();
      const list = (pending: boolean, cancelingOids: number[]) => (
        <PerpsProPositionTpSlOrderList
          scope={scope}
          amountUnit="base"
          cancelingOids={cancelingOids}
          markPrice="100"
          market={market}
          onAdd={jest.fn()}
          onCancelOrder={onCancelOrder}
          onModify={jest.fn()}
          onOpenEstimatedPnlExplanation={jest.fn()}
          pending={pending}
          position={{ ...position, tpslOrders: [first, second] }}
        />
      );
      const view = render(list(true, [2]));
      const cancelButton = (oid: number) =>
        within(
          screen.getByTestId(`perps-pro-position-tpsl-order-${oid}`),
        ).getByRole('button', { name: 'Cancel' });
      expect(cancelButton(1).props.accessibilityState).toMatchObject({
        busy: false,
        disabled: true,
      });
      expect(cancelButton(2).props.accessibilityState).toMatchObject({
        busy: true,
        disabled: true,
      });
      expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
      expect(screen.UNSAFE_getByType(ActivityIndicator).props.color).toBe(
        'neutral-title-1',
      );
      fireEvent.press(cancelButton(2));
      expect(onCancelOrder).not.toHaveBeenCalled();
      view.rerender(list(false, []));
      expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
      fireEvent.press(cancelButton(2));
      expect(onCancelOrder).toHaveBeenCalledWith(second);
    },
  );

  it.each(['partial', 'position'] as const)(
    'colors %s list PNL by profit with its own size source',
    scope => {
      for (const direction of ['long', 'short'] as const) {
        for (const kind of ['takeProfit', 'stopLoss'] as const) {
          for (const [triggerPrice, expected, color] of [
            [direction === 'long' ? '110' : '90', '+5.00', 'green-default'],
            [direction === 'long' ? '90' : '110', '-5.00', 'red-default'],
            ['100', '0.00', 'neutral-title-1'],
            ['', '-', 'neutral-title-1'],
          ]) {
            const item = {
              ...order(
                7,
                triggerPrice!,
                scope === 'position' ? '0' : '0.5',
                scope,
              ),
              kind,
            };
            const view = render(
              <PerpsProPositionTpSlOrderList
                scope={scope}
                amountUnit="base"
                cancelingOids={[]}
                markPrice="120"
                market={market}
                onAdd={jest.fn()}
                onCancelOrder={jest.fn()}
                onModify={jest.fn()}
                onOpenEstimatedPnlExplanation={jest.fn()}
                pending={false}
                position={{
                  ...position,
                  direction,
                  baseSize: scope === 'position' ? '0.5' : '2',
                  tpslOrders: [item],
                }}
              />,
            );
            const row = screen.getByTestId('perps-pro-position-tpsl-order-7');
            const values = within(row).getAllByText(expected!);
            expect(
              values.some(
                value => StyleSheet.flatten(value.props.style).color === color,
              ),
            ).toBe(true);
            view.unmount();
          }
        }
      }
    },
  );

  beforeEach(() => {
    jest.clearAllMocks();
    mockAndroid = false;
    mockThemeMode = undefined;
    mockAnimatedReactions = [];
    mockNextFormInstanceId = 0;
    mockKeyboardListeners.clear();
    mockAnimationFrameCallback = null;
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'ios',
    });
    const keyboardSubscriptions = new Map<string, Set<(event: any) => void>>();
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((eventName, listener) => {
        const listeners = keyboardSubscriptions.get(eventName) ?? new Set();
        keyboardSubscriptions.set(eventName, listeners);
        listeners.add(listener);
        mockKeyboardListeners.set(eventName, () => {
          listeners.forEach(callback =>
            callback({ endCoordinates: { height: 300, screenY: 500 } }),
          );
        });
        return {
          remove: jest.fn(() => {
            listeners.delete(listener);
            if (!listeners.size) mockKeyboardListeners.delete(eventName);
          }),
        } as ReturnType<typeof Keyboard.addListener>;
      });
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      mockAnimationFrameCallback = callback;
      return 1;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(jest.fn());
  });

  it.each(['light', 'dark'] as const)(
    'uses the new %s shell across pages and preserves every interaction lock',
    mode => {
      mockThemeMode = mode;
      const colors = ThemeColors2024[mode];
      const props = {
        amountUnit: 'base' as const,
        cancelingOids: [],
        confirmedCancelledOids: [],
        coveredByReview: false,
        defaultTab: 'partial' as const,
        market,
        onCancelOrder: jest.fn(),
        onClose: jest.fn(),
        onReview: jest.fn(),
        pending: false,
        position,
        visible: true,
      };
      const view = render(<PerpsProPositionTpSlSheet {...props} />);
      const expectShell = (snap: number, locked = false) => {
        const sheet = mockBottomSheetProps.mock.lastCall?.[0];
        expect(
          StyleSheet.flatten(screen.getByTestId('tpsl-background').props.style),
        ).toMatchObject({
          backgroundColor: colors['neutral-bg-0'],
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        });
        expect(sheet.style).toMatchObject({
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
        });
        expect(sheet.handleStyle).toMatchObject({
          backgroundColor: colors['neutral-bg-0'],
          height: 40,
          paddingTop: 10,
          paddingBottom: 24,
        });
        expect(sheet.handleIndicatorStyle).toMatchObject({
          backgroundColor: colors['neutral-sheet-handle'],
          width: 50,
          height: 6,
          borderRadius: 3,
        });
        expect(sheet.snapPoints).toEqual([snap]);
        expect(sheet.enableDynamicSizing).toBe(false);
        expect(sheet.enablePanDownToClose).toBe(!locked);
        expect(screen.getByTestId('tpsl-backdrop').props).toMatchObject({
          opacity: 0.3,
          pressBehavior: locked ? 'none' : 'close',
          appearsOnIndex: 0,
          disappearsOnIndex: -1,
        });
      };
      expectShell(758);
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-position-tpsl-tabs').props.style,
        ),
      ).toMatchObject({ paddingHorizontal: 16 });
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-add'));
      expectShell(652);
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
      fireEvent.press(screen.getAllByText('Modify')[0]!);
      expectShell(604);
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
      fireEvent.press(screen.getByText('Position TP/SL'));
      expectShell(758);
      for (const lock of ['pending', 'coveredByReview', 'reviewRequesting']) {
        view.rerender(
          <PerpsProPositionTpSlSheet {...props} {...{ [lock]: true }} />,
        );
        expectShell(758, true);
        view.rerender(<PerpsProPositionTpSlSheet {...props} />);
        if (lock === 'coveredByReview') {
          fireEvent(
            screen.getByTestId('perps-pro-position-tpsl-page-content'),
            'layout',
            {},
          );
          const observer = mockAnimatedReactions.at(-1)!;
          act(() => observer.react(observer.prepare()));
        }
        expectShell(758);
      }
      fireEvent.press(screen.getByText('TP/SL'));
      view.rerender(
        <PerpsProPositionTpSlSheet
          {...props}
          position={{ ...position, tpslOrders: [] }}
        />,
      );
      expect(screen.getByTestId('tpsl-form-add')).toBeTruthy();
      expectShell(758);
    },
  );

  it('excludes Done from the Android TP/SL viewport without changing the form height or instance', () => {
    mockAndroid = true;
    perpsProKeyboardSession.setEnabled(true);
    const view = render(
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
    const { sheetId, instanceId, minimumHeight } =
      mockFormProps.mock.lastCall?.[0];
    const snapPoints = mockBottomSheetProps.mock.lastCall?.[0].snapPoints;
    act(() => {
      perpsProKeyboardSession.focus({
        id: 'tpsl-amount',
        sheetId,
        minimum: null,
        scrollTrade: false,
        input: {
          blur: jest.fn(),
          isFocused: () => true,
          measureInWindow: jest.fn(),
        },
      });
      jest
        .mocked(Keyboard.addListener)
        .mock.calls.forEach(([event, callback]) => {
          if (event === 'keyboardDidShow') {
            callback({
              endCoordinates: { height: 300, screenY: 500 },
            } as never);
          }
        });
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('tpsl-scroll').props.style),
    ).toMatchObject({ marginBottom: 48 });
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual(
      snapPoints,
    );
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      sheetId,
      instanceId,
      minimumHeight,
    });
    view.unmount();
    perpsProKeyboardSession.setEnabled(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      paddingHorizontal: 16,
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
    fireEvent.press(screen.getAllByLabelText('Est. PnL (USDC)')[0]!);
    expect(mockOpenFieldExplanation).toHaveBeenCalledWith('estimatedPnl');
  });

  it('scrolls the form to the bottom only after a completed keyboard session', () => {
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="position"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    act(() => {
      mockKeyboardListeners.get('keyboardDidHide')?.();
    });
    expect(mockAnimationFrameCallback).toBeNull();
    expect(mockScrollToEnd).not.toHaveBeenCalled();

    act(() => {
      mockKeyboardListeners.get('keyboardDidShow')?.();
      mockKeyboardListeners.get('keyboardDidHide')?.();
    });
    expect(mockScrollToEnd).not.toHaveBeenCalled();
    act(() => {
      mockAnimationFrameCallback?.(0);
    });
    expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: true });

    act(() => {
      mockKeyboardListeners.get('keyboardDidHide')?.();
    });
    expect(mockScrollToEnd).toHaveBeenCalledTimes(1);

    act(() => {
      mockKeyboardListeners.get('keyboardDidShow')?.();
      mockKeyboardListeners.get('keyboardDidHide')?.();
    });
    rerender(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="position"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible={false}
      />,
    );
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mockKeyboardListeners.size).toBe(0);
  });

  it('waits for the Android sheet to restore before scrolling Confirm into view', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    render(
      <PerpsProPositionTpSlSheet
        amountUnit="base"
        cancelingOids={[]}
        confirmedCancelledOids={[]}
        coveredByReview={false}
        defaultTab="position"
        market={market}
        onCancelOrder={jest.fn()}
        onClose={jest.fn()}
        onReview={jest.fn()}
        pending={false}
        position={position}
        visible
      />,
    );

    const sheetProps = mockBottomSheetProps.mock.lastCall?.[0];
    act(() => {
      sheetProps.onChange(0, 100);
      mockKeyboardListeners.get('keyboardDidShow')?.();
      mockKeyboardListeners.get('keyboardDidHide')?.();
    });
    const reaction = mockAnimatedReactions.at(-1)!;
    act(() => {
      sheetProps.animatedPosition.value = 99;
      reaction.react(reaction.prepare());
    });
    expect(mockAnimationFrameCallback).toBeNull();
    expect(mockScrollToEnd).not.toHaveBeenCalled();

    act(() => {
      sheetProps.animatedPosition.value = 100;
      reaction.react(reaction.prepare());
    });
    expect(mockScrollToEnd).not.toHaveBeenCalled();
    act(() => {
      mockAnimationFrameCallback?.(0);
    });
    expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    expect(mockScrollToEnd).toHaveBeenCalledWith({ animated: false });
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
      flex: 1,
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
    expect(value.props.adjustsFontSizeToFit).toBeUndefined();
    expect(value.props.ellipsizeMode).toBeUndefined();
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      flexShrink: 0,
      position: 'absolute',
      right: 0,
      textAlign: 'right',
      top: 0,
    });
    expect(StyleSheet.flatten(value.props.style).left).toBeUndefined();
    expect(StyleSheet.flatten(value.props.style)).toMatchObject({
      fontVariant: ['tabular-nums'],
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
      minimumHeight: 426,
      presentation: 'subpage',
    });
    expect(screen.getByText('TP/SL')).toBeTruthy();
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

  it('keeps the Position form and displayed order stable through review replacement refreshes', () => {
    const initialPositionOrder = order(10, '110', '1', 'position');
    const refreshedPositionOrder = order(11, '112', '1', 'position');
    const baseProps = {
      amountUnit: 'base' as const,
      cancelingOids: [],
      confirmedCancelledOids: [],
      defaultTab: 'position' as const,
      market,
      onCancelOrder: jest.fn(),
      onClose: jest.fn(),
      onReview: jest.fn(),
      visible: true,
    };
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        coveredByReview={false}
        pending={false}
        position={{ ...position, tpslOrders: [initialPositionOrder] }}
      />,
    );
    fireEvent.press(screen.getByText('Modify'));
    const initialInstanceId = mockFormProps.mock.lastCall?.[0].instanceId;

    rerender(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        coveredByReview={false}
        pending={false}
        position={{ ...position, tpslOrders: [] }}
        reviewRequesting
      />,
    );
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      instanceId: initialInstanceId,
      pending: true,
      position: expect.objectContaining({
        tpslOrders: [initialPositionOrder],
      }),
    });

    rerender(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        coveredByReview
        pending
        position={{ ...position, tpslOrders: [refreshedPositionOrder] }}
        submissionPending
      />,
    );
    expect(mockFormProps.mock.lastCall?.[0].instanceId).toBe(initialInstanceId);
    expect(mockFormProps.mock.lastCall?.[0].position.tpslOrders).toEqual([
      initialPositionOrder,
    ]);

    rerender(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        coveredByReview={false}
        pending={false}
        position={{ ...position, tpslOrders: [refreshedPositionOrder] }}
      />,
    );
    expect(mockFormProps.mock.lastCall?.[0].instanceId).not.toBe(
      initialInstanceId,
    );
    expect(mockFormProps.mock.lastCall?.[0].position.tpslOrders).toEqual([
      refreshedPositionOrder,
    ]);
  });

  it('keeps direct cancellation on live Position order presentation', () => {
    const initialPositionOrder = order(10, '110', '1', 'position');
    const baseProps = {
      amountUnit: 'base' as const,
      cancelingOids: [10],
      confirmedCancelledOids: [],
      coveredByReview: false,
      defaultTab: 'position' as const,
      market,
      onCancelOrder: jest.fn(),
      onClose: jest.fn(),
      onReview: jest.fn(),
      pending: false,
      visible: true,
    };
    const { rerender } = render(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        position={{ ...position, tpslOrders: [initialPositionOrder] }}
      />,
    );

    rerender(
      <PerpsProPositionTpSlSheet
        {...baseProps}
        pending
        position={{ ...position, tpslOrders: [] }}
      />,
    );

    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      pending: true,
      position: expect.objectContaining({ tpslOrders: [] }),
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
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
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

    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
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
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([652]);
  });

  it('renders the 758px inline form and full position header when the TP/SL tab has no partial orders', () => {
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

    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
    expect(mockHeaderProps.mock.lastCall?.[0]).toMatchObject({
      variant: 'empty',
    });
    expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
      minimumHeight: 486,
      mode: 'add',
      presentation: 'inline-empty',
    });
    expect(screen.queryByTestId('perps-pro-position-tpsl-add')).toBeNull();
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-position-tpsl-tabs').props.style,
      ),
    ).toMatchObject({ paddingHorizontal: 16 });
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
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
  });
  const makeSheetProps = (tpslOrders = position.tpslOrders) => ({
    amountUnit: 'base' as const,
    cancelingOids: [],
    confirmedCancelledOids: [],
    coveredByReview: false,
    defaultTab: 'position' as const,
    market,
    onCancelOrder: jest.fn(),
    onClose: jest.fn(),
    onReview: jest.fn(),
    pending: false,
    position: { ...position, tpslOrders },
    visible: true,
  });

  it.each(['takeProfit', 'stopLoss'] as const)(
    'routes missing-leg Add and %s Modify to the same full-position form',
    kind => {
      const existing = {
        ...order(10, kind === 'takeProfit' ? '130' : '90', '0', 'position'),
        kind,
      };
      const input = makeSheetProps([existing]);
      const view = render(<PerpsProPositionTpSlSheet {...input} />);
      expect(mockHeaderProps.mock.lastCall?.[0].title).toBe('Position TP/SL');
      expect(screen.getByText('All')).toBeTruthy();
      expect(screen.queryByTestId('tpsl-form-position')).toBeNull();
      fireEvent.press(screen.getByText('Add'));
      expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
        mode: 'position',
        presentation: 'position-modify',
        initialOrder: null,
        position: input.position,
      });
      expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([598]);
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
      expect(screen.getByText('All')).toBeTruthy();
      fireEvent.press(screen.getByText('Modify'));
      expect(mockFormProps.mock.lastCall?.[0]).toMatchObject({
        mode: 'position',
        presentation: 'position-modify',
        position: input.position,
      });
      view.rerender(<PerpsProPositionTpSlSheet {...input} pending />);
      fireEvent.press(screen.getByTestId('perps-pro-position-tpsl-back'));
      expect(screen.getByTestId('tpsl-form-position')).toBeTruthy();
      expect(mockDismiss).not.toHaveBeenCalled();
    },
  );

  it('keeps both full-position orders and live Cancel on the list', () => {
    const tp = order(10, '130', '0', 'position');
    const sl = {
      ...order(11, '90', '0', 'position'),
      kind: 'stopLoss' as const,
    };
    const input = makeSheetProps([tp, sl]);
    render(<PerpsProPositionTpSlSheet {...input} />);
    expect(screen.getAllByText('All')).toHaveLength(2);
    expect(screen.queryByText('Add')).toBeNull();
    fireEvent.press(
      within(screen.getByTestId('perps-pro-position-tpsl-order-11')).getByText(
        'Cancel',
      ),
    );
    expect(input.onCancelOrder).toHaveBeenCalledWith(sl);
    fireEvent.press(
      within(screen.getByTestId('perps-pro-position-tpsl-order-10')).getByText(
        'Modify',
      ),
    );
    expect(mockFormProps.mock.lastCall?.[0].position.tpslOrders).toEqual([
      tp,
      sl,
    ]);
  });

  it('retains the duplicate-order form instead of picking a full-position replacement arbitrarily', () => {
    render(
      <PerpsProPositionTpSlSheet
        {...makeSheetProps([
          order(10, '130', '0', 'position'),
          order(11, '140', '0', 'position'),
        ])}
      />,
    );
    expect(screen.getByTestId('tpsl-form-position')).toBeTruthy();
    expect(mockFormProps.mock.lastCall?.[0].position.tpslOrders).toHaveLength(
      2,
    );
    expect(screen.queryByTestId('perps-pro-position-tpsl-order-10')).toBeNull();
  });

  it('keeps Tab and Add outside the one scroll viewport for 100 partial orders', () => {
    const orders = Array.from({ length: 100 }, (_, index) =>
      order(index + 1, String(130 + index), '0.01'),
    );
    render(
      <PerpsProPositionTpSlSheet
        {...makeSheetProps(orders)}
        defaultTab="partial"
      />,
    );
    const scroll = within(screen.getByTestId('tpsl-scroll'));
    expect(scroll.queryByTestId('perps-pro-position-tpsl-tabs')).toBeNull();
    expect(scroll.queryByTestId('perps-pro-position-tpsl-add')).toBeNull();
    expect(
      scroll.getAllByTestId(/^perps-pro-position-tpsl-order-\d+$/),
    ).toHaveLength(100);
    expect(
      scroll.getByTestId('perps-pro-position-tpsl-order-100'),
    ).toBeTruthy();
    fireEvent.press(
      within(scroll.getByTestId('perps-pro-position-tpsl-order-100')).getByText(
        'Modify',
      ),
    );
    expect(mockFormProps.mock.lastCall?.[0].initialOrder.oid).toBe(100);
  });

  it('keeps deterministic form geometry through a keyboard session', () => {
    render(
      <PerpsProPositionTpSlSheet
        {...makeSheetProps([])}
        defaultTab="partial"
      />,
    );
    const original = mockFormProps.mock.lastCall?.[0];
    expect(original.onContentHeightChange).toBeUndefined();
    act(() => mockKeyboardListeners.get('keyboardDidShow')?.());

    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
    expect(mockFormProps.mock.lastCall?.[0].instanceId).toBe(
      original.instanceId,
    );
    act(() => mockKeyboardListeners.get('keyboardDidHide')?.());
    act(() => mockAnimationFrameCallback?.(0));
    expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
    expect(mockFormProps.mock.lastCall?.[0].instanceId).toBe(
      original.instanceId,
    );
  });
  it('keeps one scroll host and discards the old form keyboard restore after returning to the list', () => {
    const props = {
      ...makeSheetProps(position.tpslOrders),
      defaultTab: 'partial' as const,
    };
    render(<PerpsProPositionTpSlSheet {...props} />);
    const scroll = screen.getByTestId('tpsl-scroll');
    fireEvent.press(screen.getAllByText('Modify')[0]!);
    expect(screen.getByTestId('tpsl-scroll')).toBe(scroll);
    act(() => mockKeyboardListeners.get('keyboardDidShow')?.());
    act(() => mockSheetRegistration.mock.lastCall?.[0].dismiss());
    act(() => mockKeyboardListeners.get('keyboardDidHide')?.());
    act(() => mockAnimationFrameCallback?.(0));
    expect(screen.getByTestId('tpsl-scroll')).toBe(scroll);
    expect(mockScrollToEnd).not.toHaveBeenCalled();
    expect(scroll.props.bounces).toBe(false);
    expect(scroll.props.overScrollMode).toBe('never');
    expect(screen.queryByTestId('perps-pro-position-tpsl-top-edge')).toBeNull();
    expect(scroll.props.scrollEventsHandlersHook).toBeUndefined();
  });

  it.each(['ios', 'android'])(
    'on %s waits for confirmation dismissal, keyboard hide, layout and scroll readiness',
    platform => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        value: platform,
      });
      mockAndroid = platform === 'android';
      const props = {
        ...makeSheetProps(position.tpslOrders),
        defaultTab: 'partial' as const,
      };
      const view = render(<PerpsProPositionTpSlSheet {...props} />);
      fireEvent.press(screen.getAllByText('Modify')[0]!);
      act(() => mockKeyboardListeners.get('keyboardDidShow')?.());
      const settled = { revision: 1, scope: 'partial' as const };
      view.rerender(
        <PerpsProPositionTpSlSheet
          {...props}
          coveredByReview
          settlement={settled}
        />,
      );
      expect(mockFormProps.mock.lastCall?.[0].mode).toBe('modify');
      expect(screen.getByTestId('tpsl-scroll').props.scrollEnabled).toBe(false);
      view.rerender(
        <PerpsProPositionTpSlSheet {...props} settlement={settled} />,
      );
      expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([604]);
      act(() => mockKeyboardListeners.get('keyboardDidHide')?.());
      expect(mockBottomSheetProps.mock.lastCall?.[0].snapPoints).toEqual([758]);
      expect(screen.getByTestId('tpsl-scroll').props.scrollEnabled).toBe(false);
      fireEvent(
        screen.getByTestId('perps-pro-position-tpsl-page-content'),
        'layout',
        {},
      );
      expect(mockSnapToIndex).toHaveBeenCalledWith(0);
      expect(screen.getByTestId('tpsl-scroll').props.scrollEnabled).toBe(false);
      const observer = mockAnimatedReactions.at(-1)!;
      act(() => observer.react(observer.prepare()));
      expect(screen.getByTestId('tpsl-scroll').props.scrollEnabled).toBe(true);
      expect(mockBottomSheetProps.mock.lastCall?.[0].enablePanDownToClose).toBe(
        true,
      );
      expect(mockScrollToEnd).not.toHaveBeenCalled();
    },
  );
  it('restores a skipped-confirmation settlement even when the empty main page has not changed size', () => {
    const props = { ...makeSheetProps([]), defaultTab: 'partial' as const };
    const view = render(<PerpsProPositionTpSlSheet {...props} />);
    fireEvent(
      screen.getByTestId('perps-pro-position-tpsl-page-content'),
      'layout',
      {},
    );
    view.rerender(
      <PerpsProPositionTpSlSheet
        {...props}
        settlement={{ revision: 1, scope: 'partial' }}
      />,
    );
    expect(mockSnapToIndex).toHaveBeenCalledWith(0);
    const observer = mockAnimatedReactions.at(-1)!;
    act(() => observer.react(observer.prepare()));
    expect(screen.getByTestId('tpsl-scroll').props.scrollEnabled).toBe(true);
  });

  it('keeps the edited form instance on review cancellation and unlocks it after restoration', () => {
    const props = {
      ...makeSheetProps(position.tpslOrders),
      defaultTab: 'partial' as const,
    };
    const view = render(<PerpsProPositionTpSlSheet {...props} />);
    fireEvent.press(screen.getAllByText('Modify')[0]!);
    const instance = mockFormProps.mock.lastCall?.[0].instanceId;
    fireEvent(
      screen.getByTestId('perps-pro-position-tpsl-page-content'),
      'layout',
      {},
    );
    view.rerender(<PerpsProPositionTpSlSheet {...props} coveredByReview />);
    view.rerender(<PerpsProPositionTpSlSheet {...props} />);
    expect(mockFormProps.mock.lastCall?.[0].instanceId).toBe(instance);
    expect(mockFormProps.mock.lastCall?.[0].pending).toBe(true);
    const observer = mockAnimatedReactions.at(-1)!;
    act(() => observer.react(observer.prepare()));
    expect(mockFormProps.mock.lastCall?.[0].pending).toBe(false);
    expect(mockFormProps.mock.lastCall?.[0].instanceId).toBe(instance);
  });
});
