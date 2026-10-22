import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  accountHeaderQuote,
  createAccountHeaderPresentation,
  type AccountHeaderHandle,
} from './model';
import {
  Animated,
  BackHandler,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetModalProvider,
  useBottomSheetModalInternal,
} from '@gorhom/bottom-sheet';
import { Portal } from '@gorhom/portal';
import { PerpsGestureSlider } from '@/components/perps/PerpsGestureSlider';
import { Text, TextInput } from '@/components/Typography';
import { CircleSpinnerCC } from '@/components2024/CircleSpinner/CircleSpinnerCC';
import PositionCancel from '@/assets2024/icons/perps/PerpsSimpleAccount/tpsl-cancel.svg';
import {
  GestureDetector,
  PointerType,
  State,
} from 'react-native-gesture-handler';

jest.mock('react-native-reanimated', () => {
  const nativeMock = require('react-native-reanimated/mock');
  return {
    ...nativeMock,
    useSharedValue: (value: unknown) => {
      const ref = require('react').useRef(null);
      if (!ref.current) {
        ref.current = nativeMock.useSharedValue(value);
      }
      return ref.current;
    },
  };
});

jest.mock('react-native-localize', () => ({
  getLocales: () => [{ languageCode: 'en', countryCode: 'US', isRTL: false }],
}));
jest.mock('react-native-inappbrowser-reborn', () => ({ InAppBrowser: {} }));
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  useIsFocused: () => true,
}));
jest.mock('@rneui/themed', () => ({
  Text: require('react-native').Text,
  useThemeMode: () => ({ setMode: () => {} }),
  Slider: (props: object) =>
    require('react').createElement(require('react-native').View, {
      ...props,
      testID: 'native-slider',
    }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('@gorhom/bottom-sheet');
  return {
    ...require('@gorhom/bottom-sheet/mock'),
    BottomSheetModalProvider: actual.BottomSheetModalProvider,
    useBottomSheetModalInternal: actual.useBottomSheetModalInternal,
  };
});

jest.mock('@react-native-firebase/analytics', () => ({
  __esModule: true,
  default: () => ({
    logEvent: jest.fn(),
    setAnalyticsCollectionEnabled: jest.fn(),
  }),
}));
jest.mock(
  '@safe-global/protocol-kit/dist/src/utils/eip-712',
  () => ({
    hashSafeMessage: () => {
      throw new Error('No signing in UI tests');
    },
  }),
  { virtual: true },
);
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: {}, ANDROID: {} },
  RESULTS: { GRANTED: 'granted' },
  checkMultiple: jest.fn(),
  requestMultiple: jest.fn(),
}));
jest.mock('@onekeyfe/hd-ble-sdk', () => ({}));
jest.mock('react-native-size-matters', () => ({
  moderateScale: (size: number) => size,
}));
jest.mock(
  'react-native-walkthrough-tooltip',
  () => require('react-native').View,
);
jest.mock(
  '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/constants',
  () =>
    require('@gorhom/bottom-sheet/lib/commonjs/components/bottomSheetBackdrop/constants'),
);
jest.mock(
  '@gorhom/bottom-sheet/src/components/bottomSheetBackdrop/styles',
  () =>
    require('@gorhom/bottom-sheet/lib/commonjs/components/bottomSheetBackdrop/styles'),
);
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.useFakeTimers();
const { PerpsHeaderTitle } =
  require('../PerpsHeaderTitle') as typeof import('../PerpsHeaderTitle');
const { PerpsMarketDetailHeader } =
  require('../PerpsMarketDetailHeader') as typeof import('../PerpsMarketDetailHeader');
const { PerpsHeaderRight } =
  require('../PerpsHeaderRight') as typeof import('../PerpsHeaderRight');
const { PerpEditTpSlPriceTag } =
  require('../PerpEditTpSlPriceTag') as typeof import('../PerpEditTpSlPriceTag');
const { PerpsSlider } =
  require('../PerpsSlider') as typeof import('../PerpsSlider');
const { PerpsProSlider } =
  require('@/screens/PerpsPro/components/common/PerpsProSlider') as typeof import('@/screens/PerpsPro/components/common/PerpsProSlider');
const { PerpsProManageMarginSlider } =
  require('@/screens/PerpsPro/components/positions/PerpsProManageMarginSlider') as typeof import('@/screens/PerpsPro/components/positions/PerpsProManageMarginSlider');
const { getVisibleBlockingModalIds, MODAL_GATE_IDS } =
  require('@/utils/modalGate') as typeof import('@/utils/modalGate');
const { TrackedModal } =
  require('@/components/Modal/TrackedModal') as typeof import('@/components/Modal/TrackedModal');
const { SimplePositionTpSlModal } =
  require('../SimplePositionTpSlModal') as typeof import('../SimplePositionTpSlModal');

const safe = (child: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
    <BottomSheetModalProvider>{child}</BottomSheetModalProvider>
  </SafeAreaProvider>
);
afterEach(async () => {
  await cleanupAsync();
  jest.clearAllTimers();
});

it('keeps the initial navigator header mounted when the page attaches its latest presentation', () => {
  const ref = React.createRef<AccountHeaderHandle>();
  const presenter = createAccountHeaderPresentation(next =>
    ref.current?.update(next),
  );
  const attach = (header: AccountHeaderHandle | null) => {
    ref.current = header;
    header?.update(presenter.snapshot.current);
  };
  const ui = render(safe(<PerpsMarketDetailHeader market="ETH" />));
  const initialTitle = ui.UNSAFE_getByType(PerpsHeaderTitle);
  const initialCoin = ui.getByText('ETH/USDC');
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);

  // The page can publish before its ref is attached to the navigator's header.
  act(() => {
    presenter.quote(accountHeaderQuote(110, 2), true);
    presenter.layout(62);
    presenter.scroll(70);
  });
  expect(ui.queryByText('$110.00')).toBeNull();
  const connectedHeader = (market: string) => (
    <PerpsMarketDetailHeader
      market={market}
      ref={attach}
      snapshotRef={presenter.snapshot}
    />
  );
  ui.rerender(safe(connectedHeader('ETH')));
  expect(ui.UNSAFE_getByType(PerpsHeaderTitle)).toBe(initialTitle);
  expect(ui.getByText('ETH/USDC')).toBe(initialCoin);
  expect(ui.getByText('$110.00')).toBeTruthy();
  expect(ui.queryByText('+10.00%')).toBeNull();
  expect(ui.queryByText('24h')).toBeNull();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(0);

  act(() => presenter.quote(accountHeaderQuote(120, 2), true));
  expect(ui.getByText('$120.00')).toBeTruthy();
  expect(ui.UNSAFE_getByType(PerpsHeaderTitle)).toBe(initialTitle);
  act(() => presenter.quote(accountHeaderQuote(130, 2), false));
  expect(ui.getByText('$120.00')).toBeTruthy();
  act(() => presenter.quote(accountHeaderQuote(140, 2), true));
  expect(ui.getByText('$140.00')).toBeTruthy();
  act(() => presenter.scroll(0));
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);

  act(() => presenter.scroll(70));
  act(() => presenter.reset());
  ui.rerender(safe(connectedHeader('BTC')));
  expect(ui.getByText('BTC/USDC')).toBeTruthy();
  expect(ui.queryByText('$140.00')).toBeNull();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
});

it.each(['simple', 'close', 'leverage', 'order', 'margin'] as const)(
  'connects native touch events through the real %s wrapper, controlled state and formatting',
  kind => {
    const changes: number[] = [];
    function ControlledSlider() {
      const [value, setValue] = React.useState(
        kind === 'leverage' ? 1 : kind === 'margin' ? 10.13 : 0,
      );
      const onChange = (next: number) => {
        changes.push(next);
        setValue(next);
      };
      return (
        <View>
          <Text testID="gesture-result">{String(value)}</Text>
          {kind === 'simple' || kind === 'close' ? (
            <PerpsSlider
              value={value}
              onValueChange={onChange}
              step={1}
              variant={kind === 'close' ? 'close' : undefined}
            />
          ) : kind === 'margin' ? (
            <PerpsProManageMarginSlider
              value={String(value)}
              minimum="10.13"
              maximum="20.13"
              onValueChange={next => onChange(Number(next))}
            />
          ) : (
            <PerpsProSlider
              value={value}
              onValueChange={onChange}
              minimumValue={kind === 'leverage' ? 1 : 0}
              maximumValue={kind === 'leverage' ? 40 : 100}
              tone="neutral"
              appearance={
                kind === 'leverage' ? 'leverage-dialog' : 'order-dialog'
              }
            />
          )}
        </View>
      );
    }
    const ui = render(safe(<ControlledSlider />));
    const input = ui.UNSAFE_getByType(PerpsGestureSlider);
    const host = input.findAllByType(View).find(node => node.props.onLayout)!;
    act(() =>
      host.props.onLayout({
        nativeEvent: { layout: { width: 220, height: 40 } },
      }),
    );
    const gesture = ui.UNSAFE_getByType(GestureDetector).props.gesture;
    const stateEvent = {
      handlerTag: 0,
      state: State.ACTIVE,
      oldState: State.BEGAN,
      numberOfPointers: 1,
      pointerType: PointerType.TOUCH,
    };
    const manager = {
      handlerTag: 0,
      begin: () => undefined,
      activate: () => gesture.handlers.onStart(stateEvent),
      end: () => gesture.handlers.onFinalize(stateEvent, true),
      fail: () => gesture.handlers.onFinalize(stateEvent, false),
    };
    const touch = (x: number) => {
      const point = { id: 1, x, y: 20, absoluteX: x + 50, absoluteY: 100 };
      return {
        handlerTag: 0,
        state: State.ACTIVE,
        eventType: 1,
        numberOfTouches: 1,
        pointerType: PointerType.TOUCH,
        changedTouches: [point],
        allTouches: [point],
      };
    };
    const thumbWidth = kind === 'simple' ? 14 : 20;
    const travel = 220 - thumbWidth;
    act(() => gesture.handlers.onTouchesDown(touch(20 + travel / 4), manager));
    act(() =>
      gesture.handlers.onTouchesMove(touch(20 + (travel * 3) / 4), manager),
    );
    act(() => gesture.handlers.onTouchesMove(touch(500), manager));
    act(() => gesture.handlers.onTouchesUp(touch(500), manager));
    expect(changes).toEqual(
      kind === 'leverage'
        ? [11, 31, 40]
        : kind === 'margin'
        ? [12.63, 17.63, 20.13]
        : [25, 75, 100],
    );
    expect(ui.getByTestId('gesture-result').props.children).toBe(
      String(kind === 'leverage' ? 40 : kind === 'margin' ? 20.13 : 100),
    );
  },
);

it('connects the real header to the page presenter and preserves coin selection/favorite restoration', async () => {
  const ref = React.createRef<AccountHeaderHandle>();
  const presenter = createAccountHeaderPresentation(next =>
    ref.current?.update(next),
  );
  const select = jest.fn();
  const ui = render(
    safe(
      <PerpsHeaderTitle
        ref={ref}
        snapshotRef={presenter.snapshot}
        coin="ETH"
        displayName="ETH"
        popupIsOpen={false}
        onSelectCoin={select}
      />,
    ),
  );
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
  fireEvent.press(ui.getByText('ETH/USDC'));
  act(() => {
    presenter.quote(accountHeaderQuote(110, 2), true);
    presenter.layout(62);
    presenter.scroll(70);
  });
  expect(ui.getByText('$110.00')).toBeTruthy();
  expect(ui.queryByText('+10.00%')).toBeNull();
  expect(ui.queryByText('24h')).toBeNull();
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(0);
  fireEvent.press(ui.getByText('ETH/USDC'));
  expect(select).toHaveBeenCalledTimes(2);
  // The arrow's native SVG boundary stays present in both states.
  expect(
    ui
      .UNSAFE_getAllByType(View)
      .filter(node => node.props.width === 18 && node.props.height === 18),
  ).toHaveLength(1);
  act(() => presenter.scroll(0));
  expect(ui.UNSAFE_queryAllByType(PerpsHeaderRight)).toHaveLength(1);
  expect(
    ui
      .UNSAFE_getAllByType(View)
      .filter(node => node.props.width === 18 && node.props.height === 18),
  ).toHaveLength(1);
});

it('uses the whole new price tag to cancel and preserves the default trigger presentation', async () => {
  const cancel = jest.fn(async () => {});
  const approve = jest.fn(async () => {});
  const props = {
    coin: 'ETH',
    entryPrice: 100,
    markPrice: 110,
    initTpOrSlPrice: '120',
    direction: 'Long' as const,
    size: 1,
    margin: 20,
    leverage: 5,
    liqPrice: 80,
    pxDecimals: 2,
    szDecimals: 3,
    actionType: 'tp' as const,
    quoteAsset: 'USDC',
    type: 'hasPosition' as const,
    handleSetAutoClose: jest.fn(async () => {}),
    handleCancelAutoClose: cancel,
    handleActionApproveStatus: approve,
  };
  const ui = render(
    safe(
      <PerpEditTpSlPriceTag {...props} variant="position" estimatedPnl={20} />,
    ),
  );
  await act(async () => fireEvent.press(ui.getByText('120 USDC')));
  await act(async () =>
    fireEvent.press(
      ui.getByText(/page.perpsDetail.simpleAccount.estimatedPnl/),
    ),
  );
  expect(cancel).toHaveBeenCalledTimes(2);
  expect(approve).toHaveBeenCalledTimes(2);
  ui.rerender(safe(<PerpEditTpSlPriceTag {...props} />));
  expect(ui.getByText('$120')).toBeTruthy();
  expect(
    ui.queryByText(/page.perpsDetail.simpleAccount.estimatedPnl/),
  ).toBeNull();
  ui.rerender(
    safe(
      <PerpEditTpSlPriceTag {...props} initTpOrSlPrice="" variant="position" />,
    ),
  );
  await act(async () => fireEvent.press(ui.getByText('-')));
  expect(getVisibleBlockingModalIds()).toContain(
    MODAL_GATE_IDS.perpsEditTpSlPrice,
  );
  expect(cancel).toHaveBeenCalledTimes(2);
});

it('swaps only a set position tag X for the shared spinner while cancelling', () => {
  const props = {
    coin: 'ETH',
    entryPrice: 100,
    markPrice: 110,
    initTpOrSlPrice: '120',
    direction: 'Long' as const,
    size: 1,
    margin: 20,
    leverage: 5,
    liqPrice: 80,
    pxDecimals: 2,
    szDecimals: 3,
    actionType: 'tp' as const,
    quoteAsset: 'USDC',
    type: 'hasPosition' as const,
    handleSetAutoClose: jest.fn(async () => {}),
    handleCancelAutoClose: jest.fn(async () => {}),
  };
  const ui = render(
    safe(<PerpEditTpSlPriceTag {...props} variant="position" />),
  );
  // Every SVG shares one mock type here; the X is the 16pt icon outside the
  // spinner.
  const xIcons = () => {
    const spinnerIcons = new Set(
      ui
        .UNSAFE_queryAllByType(CircleSpinnerCC)
        .flatMap(spinner => spinner.findAllByType(PositionCancel)),
    );
    return ui
      .UNSAFE_queryAllByType(PositionCancel)
      .filter(
        node =>
          node.props.width === 16 &&
          node.props.height === 16 &&
          !spinnerIcons.has(node),
      );
  };
  expect(xIcons()).toHaveLength(1);
  const cancelColor = xIcons()[0].props.color;
  expect(ui.UNSAFE_queryByType(CircleSpinnerCC)).toBeNull();

  ui.rerender(
    safe(
      <PerpEditTpSlPriceTag
        {...props}
        variant="position"
        actionPending
        cancelPending
      />,
    ),
  );
  const spinner = ui.UNSAFE_getByType(CircleSpinnerCC);
  // Same 16pt slot and colour as the X, so the tag geometry never shifts.
  expect(spinner.props).toMatchObject({ size: 16, color: cancelColor });
  // The 24pt asset must render at 16pt, or it orbits the 16pt rotating box.
  expect(spinner.findByType(PositionCancel).props).toMatchObject({
    width: 16,
    height: 16,
  });
  expect(xIcons()).toHaveLength(0);
  expect(ui.getByText('120 USDC')).toBeTruthy();
  expect(ui.getByRole('button').props.accessibilityState).toEqual({
    busy: true,
    disabled: true,
  });

  // A set in flight (pending without cancel) keeps the X.
  ui.rerender(
    safe(<PerpEditTpSlPriceTag {...props} variant="position" actionPending />),
  );
  expect(ui.UNSAFE_queryByType(CircleSpinnerCC)).toBeNull();
  expect(xIcons()).toHaveLength(1);

  // Draft tags in the open popup never show it.
  ui.rerender(safe(<PerpEditTpSlPriceTag {...props} cancelPending />));
  expect(ui.UNSAFE_queryByType(CircleSpinnerCC)).toBeNull();
  expect(xIcons()).toHaveLength(1);
});

it('draws the close progress and points from the thumb UI-thread position', () => {
  const props = {
    variant: 'close' as const,
    onValueChange: jest.fn(),
    step: 1,
  };
  const ui = render(safe(<PerpsSlider {...props} value={30} />));
  const position = ui.UNSAFE_getByType(PerpsGestureSlider).props.positionValue;
  // The thumb and the custom track share one value: no React round trip.
  expect(position).toBeDefined();
  const width = () =>
    StyleSheet.flatten(ui.getByTestId('perps-close-progress').props.style)
      .width;
  const opacity = (id: string) =>
    StyleSheet.flatten(ui.getByTestId(id).props.style).opacity;
  expect(position.value).toBe(30);
  expect(width()).toBe('30%');
  expect(opacity('perps-close-point-25-selected')).toBe(1);
  expect(opacity('perps-close-point-50-selected')).toBe(0);
  expect(opacity('perps-close-point-50-unselected')).toBe(1);

  // A drag moves the shared value ahead of the controlled prop.
  position.value = 60;
  ui.rerender(safe(<PerpsSlider {...props} value={30} />));
  expect(width()).toBe('60%');
  expect(opacity('perps-close-point-50-selected')).toBe(1);
  expect(opacity('perps-close-point-50-unselected')).toBe(0);
  expect(opacity('perps-close-point-75-selected')).toBe(0);

  // Default sliders keep their own position and built-in track.
  ui.rerender(safe(<PerpsSlider value={30} onValueChange={jest.fn()} />));
  expect(
    ui.UNSAFE_getByType(PerpsGestureSlider).props.positionValue,
  ).toBeUndefined();
  expect(ui.queryByTestId('perps-close-progress')).toBeNull();
});

// Close haptics are throttled like Perps Pro; drive a clock so each case
// decides how far apart native slider events arrive.
let hapticClock = 0;
const advanceHapticClock = (ms: number) => {
  hapticClock += ms;
};
let dateNow: jest.SpyInstance | undefined;
const startHapticClock = () => {
  hapticClock = 1_000;
  dateNow = jest.spyOn(Date, 'now').mockImplementation(() => hapticClock);
};
afterEach(() => {
  dateNow?.mockRestore();
  dateNow = undefined;
});

it('keeps default slider haptics isolated and gives close a haptic per step', () => {
  startHapticClock();
  const trigger = require('react-native-haptic-feedback').trigger;
  trigger.mockClear();
  const change = jest.fn();
  const ui = render(
    safe(<PerpsSlider value={0} onValueChange={change} step={1} />),
  );
  expect(
    ui.UNSAFE_getByType(PerpsGestureSlider).props.minimumTrackTintColor,
  ).toBe('#50D2C1');
  act(() => {
    for (const value of [25, 50, 50, 75, 100]) {
      advanceHapticClock(100);
      ui.UNSAFE_getByType(PerpsGestureSlider).props.onValueChange(value);
    }
  });
  expect(trigger).toHaveBeenCalledTimes(2);
  trigger.mockClear();
  change.mockClear();
  ui.rerender(
    safe(
      <PerpsSlider variant="close" value={0} onValueChange={change} step={1} />,
    ),
  );
  const slider = ui.UNSAFE_getByType(PerpsGestureSlider);
  expect(slider.props.step).toBe(1);
  act(() => {
    for (const value of [1, 2, 2, 3, 4]) {
      advanceHapticClock(100);
      slider.props.onValueChange(value);
    }
  });
  expect(change).toHaveBeenCalledTimes(5);
  expect(trigger).toHaveBeenCalledTimes(4);
  expect(trigger).toHaveBeenLastCalledWith('impactLight', {
    enableVibrateFallback: false,
    ignoreAndroidSystemSettings: false,
  });
});

it.each([
  {
    initial: 0,
    values: [0, 1, 1, 2, 5, 4, 100, 99],
    pulses: [0, 1, 0, 1, 1, 1, 1, 1],
  },
  { initial: 0, values: [0.4, 0.6, 0.7, 1.4], pulses: [0, 1, 0, 0] },
  { initial: 100, values: [100, 120, -5, 0], pulses: [0, 0, 1, 0] },
])(
  'pulses once per changed step without relying on exact values: $initial/$values',
  ({ initial, values, pulses }) => {
    startHapticClock();
    const trigger = require('react-native-haptic-feedback').trigger;
    trigger.mockClear();
    const change = jest.fn();
    const ui = render(
      safe(
        <PerpsSlider
          variant="close"
          value={initial}
          onValueChange={change}
          step={1}
        />,
      ),
    );
    expect(trigger).not.toHaveBeenCalled();
    act(() =>
      ui.UNSAFE_getByType(PerpsGestureSlider).props.onSlidingStart(initial),
    );
    values.forEach((value, i) => {
      advanceHapticClock(100);
      const before = trigger.mock.calls.length;
      act(() =>
        ui.UNSAFE_getByType(PerpsGestureSlider).props.onValueChange(value),
      );
      // A single native event emits at most one pulse, even across many steps.
      expect(trigger.mock.calls.length - before).toBe(pulses[i]);
    });
    expect(change.mock.calls.map(([value]) => value)).toEqual(values);
  },
);

it('throttles close step pulses to one per 80ms during a fast drag', () => {
  startHapticClock();
  const trigger = require('react-native-haptic-feedback').trigger;
  trigger.mockClear();
  const ui = render(
    safe(
      <PerpsSlider
        variant="close"
        value={0}
        onValueChange={jest.fn()}
        step={1}
      />,
    ),
  );
  const slider = ui.UNSAFE_getByType(PerpsGestureSlider);
  act(() => slider.props.onSlidingStart(0));
  act(() => slider.props.onValueChange(1));
  expect(trigger).toHaveBeenCalledTimes(1);
  for (const value of [2, 3, 4]) {
    advanceHapticClock(20);
    act(() => slider.props.onValueChange(value));
  }
  expect(trigger).toHaveBeenCalledTimes(1);
  advanceHapticClock(20);
  act(() => slider.props.onValueChange(5));
  expect(trigger).toHaveBeenCalledTimes(2);
});

it('handles track-tap ordering, controlled resets, and disabled close sliders', () => {
  startHapticClock();
  const trigger = require('react-native-haptic-feedback').trigger;
  trigger.mockClear();
  const change = jest.fn();
  const start = jest.fn();
  const complete = jest.fn();
  const sliderProps = {
    variant: 'close' as const,
    onValueChange: change,
    onSlidingStart: start,
    onSlidingComplete: complete,
    step: 1,
  };
  const ui = render(safe(<PerpsSlider {...sliderProps} value={100} />));
  act(() => {
    const slider = ui.UNSAFE_getByType(PerpsGestureSlider);
    slider.props.onValueChange(24);
    slider.props.onSlidingStart(24);
    slider.props.onValueChange(24);
    slider.props.onSlidingComplete(24);
  });
  expect(trigger).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(1);
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={100} />));
  expect(trigger).toHaveBeenCalledTimes(1);
  advanceHapticClock(100);
  act(() => ui.UNSAFE_getByType(PerpsGestureSlider).props.onValueChange(100));
  expect(trigger).toHaveBeenCalledTimes(1);
  act(() =>
    ui.UNSAFE_getByType(PerpsGestureSlider).props.onSlidingComplete(100),
  );
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={51} />));
  advanceHapticClock(100);
  act(() => ui.UNSAFE_getByType(PerpsGestureSlider).props.onValueChange(49));
  expect(trigger).toHaveBeenCalledTimes(2);
  ui.rerender(safe(<PerpsSlider {...sliderProps} value={49} disabled />));
  const before = change.mock.calls.length;
  advanceHapticClock(100);
  act(() => ui.UNSAFE_getByType(PerpsGestureSlider).props.onValueChange(0));
  expect(trigger).toHaveBeenCalledTimes(2);
  expect(change).toHaveBeenCalledTimes(before);
});

it.each(
  [false, true, undefined].flatMap(result =>
    (['position', undefined] as const).map(variant => ({ result, variant })),
  ),
)(
  'keeps the $variant editor open only for a rejected result ($result)',
  async ({ result, variant }) => {
    const submit = jest.fn(async () => result);
    const ui = render(
      safe(
        <PerpEditTpSlPriceTag
          coin="ETH"
          variant={variant}
          actionType="tp"
          type={variant === 'position' ? 'hasPosition' : 'openPosition'}
          entryPrice={100}
          markPrice={110}
          initTpOrSlPrice=""
          direction="Long"
          size={1}
          margin={20}
          leverage={5}
          liqPrice={80}
          pxDecimals={2}
          szDecimals={3}
          quoteAsset="USDC"
          handleSetAutoClose={submit}
          handleCancelAutoClose={async () => {}}
        />,
      ),
    );
    await act(async () => fireEvent.press(ui.getByText('-')));
    fireEvent.changeText(ui.getByPlaceholderText('$0'), '120');
    await act(async () => fireEvent.press(ui.getByText('global.confirm')));
    expect(submit).toHaveBeenCalledWith('120');
    // Assert the editor itself: when the modal gate is released (on hide, or
    // only after the iOS dismiss animation) is TrackedModal's concern.
    const editorOpen = result === false;
    const EditorModal = variant ? SimplePositionTpSlModal : TrackedModal;
    expect(ui.UNSAFE_getByType(EditorModal).props.visible).toBe(editorOpen);
    act(() => jest.advanceTimersByTime(350));
    expect(ui.queryByPlaceholderText('$0') !== null).toBe(editorOpen);
    if (editorOpen) {
      expect(getVisibleBlockingModalIds()).toContain(
        MODAL_GATE_IDS.perpsEditTpSlPrice,
      );
    } else {
      // The Jest Modal mock never finishes a dismiss animation; finish it on
      // the native Modal that TrackedModal renders.
      if (!variant) {
        const [nativeModal] = ui.UNSAFE_getByType(TrackedModal).children;
        act(() =>
          typeof nativeModal === 'string'
            ? undefined
            : nativeModal.props.onDismiss?.(),
        );
      }
      expect(getVisibleBlockingModalIds()).not.toContain(
        MODAL_GATE_IDS.perpsEditTpSlPrice,
      );
    }
  },
);

it('keeps a later password surface above the position draft through quote updates and cancellation', async () => {
  const originalOS = Platform.OS;
  Platform.OS = 'android';
  const backListeners = new Set<() => boolean | null | undefined>();
  const back = jest
    .spyOn(BackHandler, 'addEventListener')
    .mockImplementation((_event, listener) => {
      backListeners.add(listener);
      return { remove: () => backListeners.delete(listener) };
    });
  const dispatchBack = () =>
    [...backListeners].reverse().some(listener => listener());
  const approve = jest.fn(async () => {});
  const accepted = jest.fn();
  let requestPassword: () => Promise<boolean>;
  const submit = jest.fn(async () => {
    const unlocked = await requestPassword();
    if (unlocked) {
      accepted();
    }
    return unlocked;
  });

  // Only the password surface/response is a fixture. The editor, dynamic
  // BottomSheet host, Portal ordering, request lifecycle and modal gate are real.
  // This is not password-verification or native touch/keyboard coverage.
  function PasswordSurface({ complete }: { complete: (ok: boolean) => void }) {
    const { hostName } = useBottomSheetModalInternal();
    const [password, setPassword] = React.useState('');
    React.useEffect(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          complete(false);
          return true;
        },
      );
      return () => subscription.remove();
    }, [complete]);
    return (
      <Portal hostName={hostName} name="test-password-surface">
        <View key="test-password-surface">
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => complete(true)}>
            <Text>Unlock fixture</Text>
          </TouchableOpacity>
        </View>
      </Portal>
    );
  }
  function EditorWithPassword({ markPrice }: { markPrice: number }) {
    const [pending, setPending] = React.useState<{
      resolve: (ok: boolean) => void;
    }>();
    requestPassword = () => new Promise(resolve => setPending({ resolve }));
    const complete = React.useCallback(
      (ok: boolean) => {
        pending?.resolve(ok);
        setPending(undefined);
      },
      [pending],
    );
    return (
      <>
        <PerpEditTpSlPriceTag
          coin="ETH"
          variant="position"
          actionType="tp"
          type="hasPosition"
          entryPrice={100}
          markPrice={markPrice}
          initTpOrSlPrice=""
          direction="Long"
          size={1}
          margin={20}
          leverage={5}
          liqPrice={80}
          pxDecimals={2}
          szDecimals={3}
          quoteAsset="USDC"
          handleActionApproveStatus={approve}
          handleSetAutoClose={submit}
          handleCancelAutoClose={async () => {}}
        />
        {pending && <PasswordSurface complete={complete} />}
      </>
    );
  }
  try {
    const ui = render(safe(<EditorWithPassword markPrice={110} />));
    expect(getVisibleBlockingModalIds()).not.toContain(
      MODAL_GATE_IDS.perpsEditTpSlPrice,
    );
    expect(backListeners.size).toBe(0);
    await act(async () => fireEvent.press(ui.getByText('-')));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    expect(ui.UNSAFE_queryAllByType(TrackedModal)).toHaveLength(0);
    const draft = ui.getByPlaceholderText('$0');
    fireEvent.changeText(draft, '120');
    const confirm = ui.getByRole('button', { name: 'global.confirm' });
    await act(async () => {
      fireEvent.press(confirm);
    });
    const password = ui.getByPlaceholderText('Password');
    expect(
      ui.UNSAFE_getAllByType(TextInput).map(node => node.props.placeholder),
    ).toEqual(['$0', 'Password']);
    expect(backListeners.size).toBe(2);
    expect(submit).toHaveBeenCalledWith('120');
    expect(accepted).not.toHaveBeenCalled();
    expect(getVisibleBlockingModalIds()).toContain(
      MODAL_GATE_IDS.perpsEditTpSlPrice,
    );

    ui.rerender(safe(<EditorWithPassword markPrice={111} />));
    expect(ui.getByPlaceholderText('$0')).toBe(draft);
    expect(draft.props.value).toBe('$120');
    expect(ui.getByPlaceholderText('Password')).toBe(password);
    expect(
      ui.UNSAFE_getAllByType(TextInput).map(node => node.props.placeholder),
    ).toEqual(['$0', 'Password']);
    fireEvent.changeText(password, 'fixture-password');
    expect(password.props.value).toBe('fixture-password');
    fireEvent.press(confirm);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(dispatchBack()).toBe(true);
    });
    expect(ui.queryByPlaceholderText('Password')).toBeNull();
    expect(ui.getByPlaceholderText('$0')).toBe(draft);
    expect(draft.props.value).toBe('$120');
    expect(accepted).not.toHaveBeenCalled();
    expect(backListeners.size).toBe(1);

    await act(async () => {
      fireEvent.press(confirm);
    });
    expect(ui.getByPlaceholderText('Password')).toBeTruthy();
    await act(async () => {
      fireEvent.press(ui.getByText('Unlock fixture'));
    });
    act(() => jest.advanceTimersByTime(350));
    expect(submit).toHaveBeenCalledTimes(2);
    expect(accepted).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledTimes(1);
    expect(ui.queryByPlaceholderText('$0')).toBeNull();
    expect(getVisibleBlockingModalIds()).not.toContain(
      MODAL_GATE_IDS.perpsEditTpSlPrice,
    );
    expect(backListeners.size).toBe(0);
    expect(dispatchBack()).toBe(false);

    await act(async () => fireEvent.press(ui.getByText('-')));
    expect(ui.getByPlaceholderText('$0')).toBeTruthy();
    act(() => {
      expect(dispatchBack()).toBe(true);
    });
    expect(getVisibleBlockingModalIds()).toContain(
      MODAL_GATE_IDS.perpsEditTpSlPrice,
    );
    act(() => jest.advanceTimersByTime(350));
    expect(ui.queryByPlaceholderText('$0')).toBeNull();
    expect(getVisibleBlockingModalIds()).not.toContain(
      MODAL_GATE_IDS.perpsEditTpSlPrice,
    );
    expect(backListeners.size).toBe(0);
  } finally {
    await cleanupAsync();
    back.mockRestore();
    Platform.OS = originalOS;
  }
});

it('retains the position portal and gate through fade-out, reopening and unmount', async () => {
  const animations: {
    finish: (result: { finished: boolean }) => void;
    stop: jest.Mock;
  }[] = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => {
    const transition = {
      finish: (_result: { finished: boolean }) => {},
      stop: jest.fn(),
    };
    animations.push(transition);
    return {
      start: callback => {
        transition.finish = callback || (() => {});
      },
      stop: transition.stop,
      reset: jest.fn(),
    };
  });
  const modalId = MODAL_GATE_IDS.perpsEditTpSlPrice;
  const surface = (visible: boolean) =>
    safe(
      <SimplePositionTpSlModal visible={visible} modalId={modalId}>
        <TextInput placeholder="Retained draft" defaultValue="120" />
      </SimplePositionTpSlModal>,
    );
  try {
    const ui = render(surface(true));
    const draft = ui.getByPlaceholderText('Retained draft');
    act(() => animations[0].finish({ finished: true }));
    ui.rerender(surface(false));
    const interruptedExit = animations[animations.length - 1];
    expect(getVisibleBlockingModalIds()).toContain(modalId);
    expect(ui.getByPlaceholderText('Retained draft')).toBe(draft);

    ui.rerender(surface(true));
    expect(interruptedExit.stop).toHaveBeenCalledTimes(1);
    act(() => interruptedExit.finish({ finished: true }));
    expect(ui.getByPlaceholderText('Retained draft')).toBe(draft);
    expect(getVisibleBlockingModalIds()).toContain(modalId);

    ui.rerender(surface(false));
    act(() => animations[animations.length - 1].finish({ finished: true }));
    expect(ui.queryByPlaceholderText('Retained draft')).toBeNull();
    expect(getVisibleBlockingModalIds()).not.toContain(modalId);

    ui.rerender(surface(true));
    expect(ui.getByPlaceholderText('Retained draft')).toBeTruthy();
    ui.rerender(surface(false));
    const unmountedExit = animations[animations.length - 1];
    await cleanupAsync();
    expect(unmountedExit.stop).toHaveBeenCalledTimes(1);
    act(() => unmountedExit.finish({ finished: true }));
    expect(getVisibleBlockingModalIds()).not.toContain(modalId);
  } finally {
    await cleanupAsync();
    timing.mockRestore();
  }
});
