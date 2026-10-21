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
import { View } from 'react-native';
import { PerpsGestureSlider } from '@/components/perps/PerpsGestureSlider';
import { Text } from '@/components/Typography';
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
jest.mock('@gorhom/bottom-sheet', () => require('@gorhom/bottom-sheet/mock'));

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

const safe = (child: React.ReactNode) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
    {child}
  </SafeAreaProvider>
);
afterEach(async () => {
  await cleanupAsync();
  jest.clearAllTimers();
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
  // Every SVG shares one mock type here; the X is the 16pt icon passed
  // width/height directly, while the spinner's icon is sized via style.
  const xIcons = () =>
    ui
      .UNSAFE_queryAllByType(PositionCancel)
      .filter(node => node.props.width === 16 && node.props.height === 16);
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

it.each([false, true, undefined])(
  'keeps the editor open only for a rejected result (%s), preserving draft-mode void callbacks',
  async result => {
    const submit = jest.fn(async () => result);
    const ui = render(
      safe(
        <PerpEditTpSlPriceTag
          coin="ETH"
          variant="position"
          actionType="tp"
          type="hasPosition"
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
    expect(
      getVisibleBlockingModalIds().includes(MODAL_GATE_IDS.perpsEditTpSlPrice),
    ).toBe(result === false);
  },
);
