import 'react-native-gesture-handler/jestSetup';
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
  PointerType,
  State,
  type GestureTouchEvent,
} from 'react-native-gesture-handler';
import { PerpsGestureSlider, perpsSliderValueAt } from './PerpsGestureSlider';

let mockQueueJS = false;
let mockJSQueue: Array<() => void> = [];
let mockQueueUI = false;
let mockUIQueue: Array<() => void> = [];
let frameId = 0;
let frames = new Map<number, FrameRequestCallback>();

jest.mock('react-native-reanimated', () => {
  const { View: NativeView, Animated } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: NativeView,
      createAnimatedComponent: Animated.createAnimatedComponent,
    },
    runOnJS:
      (fn: Function) =>
      (...args: unknown[]) => {
        if (mockQueueJS) {
          mockJSQueue.push(() => fn(...args));
        } else {
          fn(...args);
        }
      },
    runOnUI:
      (fn: Function) =>
      (...args: unknown[]) => {
        if (mockQueueUI) {
          mockUIQueue.push(() => fn(...args));
        } else {
          fn(...args);
        }
      },
    useAnimatedStyle: (fn: Function) => fn(),
    useEvent: () => jest.fn(),
    // Preserve UI shared values across controlled React renders.
    useSharedValue: (value: unknown) =>
      require('react').useRef({ value }).current,
  };
});

beforeEach(() => {
  mockQueueJS = false;
  mockJSQueue = [];
  mockQueueUI = false;
  mockUIQueue = [];
  frames = new Map();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
    frames.set(++frameId, callback);
    return frameId;
  });
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => {
    frames.delete(id);
  });
});
afterEach(() => jest.restoreAllMocks());

const flushJS = () =>
  act(() => mockJSQueue.splice(0).forEach(deliver => deliver()));
const flushFrame = () =>
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(0));
  });

type SliderProps = React.ComponentProps<typeof PerpsGestureSlider>;
const stateEvent = {
  handlerTag: 0,
  state: State.ACTIVE,
  oldState: State.BEGAN,
  numberOfPointers: 1,
  pointerType: PointerType.TOUCH,
};
const touchEvent = (x: number, id = 1): GestureTouchEvent => {
  const touch = { id, x, y: 20, absoluteX: x + 50, absoluteY: 120 };
  return {
    handlerTag: 0,
    numberOfTouches: 1,
    eventType: 1,
    allTouches: [touch],
    changedTouches: [touch],
    state: State.ACTIVE,
    pointerType: PointerType.TOUCH,
  };
};

const mountSlider = (overrides: Partial<SliderProps> = {}) => {
  let props: SliderProps = {
    value: 0,
    step: 1,
    allowTouchTrack: true,
    thumbStyle: { width: 20, height: 20 },
    onValueChange: jest.fn(),
    onSlidingStart: jest.fn(),
    onSlidingComplete: jest.fn(),
    ...overrides,
  };
  const element = () => (
    <GestureHandlerRootView>
      <PerpsGestureSlider {...props} />
    </GestureHandlerRootView>
  );
  const ui = render(element());
  const host = ui
    .UNSAFE_getAllByType(View)
    .find(node => node.props.accessibilityRole === 'adjustable')!;
  fireEvent(host, 'layout', {
    nativeEvent: { layout: { width: 220, height: 40 } },
  });
  const getGesture = () =>
    ui.UNSAFE_getByType(GestureDetector).props.gesture as ReturnType<
      typeof Gesture.Manual
    >;
  // This models the native boundary's callbacks, not native arbitration/frames.
  const stream = () => {
    const gesture = getGesture();
    const manager = {
      handlerTag: 0,
      begin: jest.fn(),
      activate: jest.fn(() => gesture.handlers.onStart?.(stateEvent)),
      end: jest.fn((): void => {
        // iOS RNGH cancels tracked pointers when the state manager ends a gesture.
        gesture.handlers.onTouchesCancelled?.(touchEvent(0), manager);
        gesture.handlers.onFinalize?.(stateEvent, true);
      }),
      fail: jest.fn(() => gesture.handlers.onFinalize?.(stateEvent, false)),
    };
    return {
      gesture,
      manager,
      down: (x: number, id = 1) =>
        act(() => gesture.handlers.onTouchesDown?.(touchEvent(x, id), manager)),
      move: (x: number, id = 1) =>
        act(() => gesture.handlers.onTouchesMove?.(touchEvent(x, id), manager)),
      up: (x: number, id = 1) =>
        act(() => gesture.handlers.onTouchesUp?.(touchEvent(x, id), manager)),
      cancel: () =>
        act(() =>
          gesture.handlers.onTouchesCancelled?.(touchEvent(0), manager),
        ),
    };
  };
  return {
    ui,
    props,
    stream,
    getGesture,
    rerender: (next: Partial<SliderProps>) => {
      props = { ...props, ...next };
      ui.rerender(element());
    },
  };
};

it('claims native ownership on DOWN and keeps a continuous drag across controlled rerenders', () => {
  const events: string[] = [];
  const slider = mountSlider({
    onSlidingStart: value => events.push(`start:${value}`),
    onValueChange: value => events.push(`value:${value}`),
    onSlidingComplete: value => events.push(`end:${value}`),
  });
  const stream = slider.stream();
  expect(stream.gesture.handlerName).toBe('ManualGestureHandler');
  expect(stream.gesture.config.simultaneousWith).toBeUndefined();
  stream.down(70); // touch area inset 10 + thumb radius 10 + 25% of 200
  expect(stream.manager.activate).toHaveBeenCalledTimes(1);
  slider.rerender({ value: 25 });
  expect(slider.getGesture()).toBe(stream.gesture);
  stream.move(120);
  slider.rerender({ value: 50 });
  stream.move(120.2); // same step, no redundant form update
  stream.move(220);
  stream.move(500);
  stream.up(500);
  expect(events).toEqual([
    'start:0',
    'value:25',
    'value:50',
    'value:100',
    'end:100',
  ]);
});

it('drives an injected position on the UI thread ahead of the controlled value', () => {
  const positionValue = { value: 0 } as NonNullable<
    SliderProps['positionValue']
  >;
  const slider = mountSlider({ positionValue });
  const stream = slider.stream();
  stream.down(70);
  expect(positionValue.value).toBe(25);
  // The prop has not caught up yet; the injected value already has.
  stream.move(120);
  expect(positionValue.value).toBe(50);
  expect(slider.props.value).toBe(0);
  stream.up(120);
  // A controlled update outside a gesture still writes through.
  slider.rerender({ value: 80 });
  expect(positionValue.value).toBe(80);
});

it.each([
  { minimumValue: 1, maximumValue: 40, step: 1, value: 1, expected: 21 },
  {
    minimumValue: 10.13,
    maximumValue: 20.13,
    step: 0.01,
    value: 10.13,
    expected: 15.13,
  },
])(
  'preserves leverage and decimal margin domains: $minimumValue..$maximumValue',
  props => {
    const slider = mountSlider(props);
    const stream = slider.stream();
    stream.down(120);
    stream.up(120);
    expect(slider.props.onValueChange).toHaveBeenLastCalledWith(props.expected);
    expect(slider.props.onSlidingComplete).toHaveBeenLastCalledWith(
      props.expected,
    );
  },
);

it('finishes cancellation once, ignores a second finger and starts a fresh gesture', () => {
  const slider = mountSlider();
  const stream = slider.stream();
  stream.down(20);
  stream.down(200, 2);
  stream.move(200, 2);
  stream.up(200, 2);
  expect(slider.props.onSlidingComplete).not.toHaveBeenCalled();
  stream.move(120);
  stream.cancel();
  expect(stream.manager.end).toHaveBeenCalledTimes(1);
  expect(stream.manager.fail).not.toHaveBeenCalled();
  stream.up(120);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
  expect(slider.props.onSlidingComplete).toHaveBeenLastCalledWith(50);
  slider.rerender({ value: 100 });
  const next = slider.stream();
  next.down(220);
  next.move(20);
  next.up(20);
  expect(slider.props.onSlidingComplete).toHaveBeenLastCalledWith(0);
  expect(slider.props.onSlidingStart).toHaveBeenLastCalledWith(100);
});

it.each([
  { disabled: true },
  { minimumValue: 5, maximumValue: 5 },
  { value: Number.NaN },
])('does not change disabled/unusable inputs: %j', props => {
  const slider = mountSlider(props);
  expect(slider.getGesture().config.enabled).toBe(false);
  const stream = slider.stream();
  stream.down(120);
  stream.move(220);
  stream.up(220);
  expect(slider.props.onValueChange).not.toHaveBeenCalled();
  expect(slider.props.onSlidingStart).not.toHaveBeenCalled();
  expect(slider.props.onSlidingComplete).not.toHaveBeenCalled();
});

it.each([{ disabled: true }, { maximumValue: 40 }])(
  'releases an interrupted owner and rejects old queued events on configuration changes: %j',
  next => {
    const slider = mountSlider();
    const stream = slider.stream();
    stream.down(120);
    slider.rerender(next);
    expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
    stream.move(220);
    stream.up(220);
    expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
    expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
  },
);

it('releases the drag latch on unmount and rejects late deliveries', () => {
  const slider = mountSlider();
  const stream = slider.stream();
  stream.down(70);
  slider.ui.unmount();
  stream.move(220);
  stream.up(220);
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledWith(25);
});

it('rejects JS deliveries already queued before a range change or unmount', () => {
  const slider = mountSlider();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  stream.move(120);
  stream.up(120);
  slider.rerender({ maximumValue: 40 });
  act(() => mockJSQueue.splice(0).forEach(deliver => deliver()));
  expect(slider.props.onSlidingStart).not.toHaveBeenCalled();
  expect(slider.props.onValueChange).not.toHaveBeenCalled();
  expect(slider.props.onSlidingComplete).not.toHaveBeenCalled();
  const next = slider.stream();
  next.down(70);
  slider.ui.unmount();
  act(() => mockJSQueue.splice(0).forEach(deliver => deliver()));
  expect(slider.props.onValueChange).not.toHaveBeenCalled();
});

it('uses updated callbacks without recreating an active gesture', () => {
  const slider = mountSlider();
  const stream = slider.stream();
  stream.down(20);
  const change = jest.fn();
  slider.rerender({ onValueChange: change });
  expect(slider.getGesture()).toBe(stream.gesture);
  stream.move(120);
  expect(change).toHaveBeenCalledWith(50);
});

it('retains minimum-relative rounding and clamps at both endpoints', () => {
  expect(perpsSliderValueAt(-20, 200, 10.13, 20.135, 0.01)).toBe(10.13);
  expect(perpsSliderValueAt(250, 200, 10.13, 20.135, 0.01)).toBe(20.135);
  expect(perpsSliderValueAt(30, 200, 0, 100, 1)).toBe(15);
});

const mountLatest = (overrides: Partial<SliderProps> = {}) => {
  const positionValue = { value: overrides.value ?? 0 } as NonNullable<
    SliderProps['positionValue']
  >;
  const slider = mountSlider({
    valueChangeMode: 'latest',
    showTrack: false,
    positionValue,
    ...overrides,
  });
  return { ...slider, positionValue };
};

it('bounds the notification queue and samples the latest position after a busy JS frame', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(20);
  for (let x = 22; x <= 180; x += 2) {
    stream.move(x);
  }
  expect(slider.positionValue.value).toBe(80);
  expect(mockJSQueue).toHaveLength(1);
  expect(slider.props.onValueChange).not.toHaveBeenCalled();
  flushJS();
  expect(frames.size).toBe(1);
  stream.move(140);
  flushFrame();
  expect(mockJSQueue).toHaveLength(1);
  flushJS();
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onValueChange).toHaveBeenLastCalledWith(60);
  expect(slider.positionValue.value).toBe(60);
});

it('keeps a pending read bounded and catches up once when UI advances during delivery', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  flushJS();
  flushFrame(); // sample 25, waiting on JS
  stream.move(160); // UI is now 70
  expect(mockJSQueue).toHaveLength(1);
  flushJS(); // ack schedules exactly one read of the newer position
  flushJS();
  expect(frames.size).toBe(1);
  flushFrame();
  flushJS();
  expect(slider.props.onValueChange).toHaveBeenLastCalledWith(70);
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(2);
  expect(mockJSQueue).toHaveLength(0);
});

it('delivers the final UI value without replaying a queued drag after release', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  stream.move(180);
  stream.move(140);
  stream.up(140);
  expect(slider.positionValue.value).toBe(60);
  flushJS();
  expect(frames.size).toBe(0);
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onValueChange).toHaveBeenCalledWith(60);
  expect(slider.props.onSlidingStart).toHaveBeenCalledWith(0);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledWith(60);
  slider.rerender({ value: 25 });
  expect(slider.positionValue.value).toBe(60);
  slider.rerender({ value: 60 });
  slider.rerender({ value: 100 }); // a real controlled reset after final commit
  expect(slider.positionValue.value).toBe(100);
});

it('rejects old UI echo commands even if they execute after the final commit', () => {
  const slider = mountLatest();
  const stream = slider.stream();
  stream.down(70);
  flushFrame(); // publish 25
  mockQueueUI = true;
  slider.rerender({ value: 25 });
  const oldEcho = mockUIQueue.splice(0);
  mockQueueUI = false;
  stream.move(160);
  stream.up(160);
  slider.rerender({ value: 70 });
  expect(slider.positionValue.value).toBe(70);
  act(() => oldEcho.forEach(deliver => deliver()));
  expect(slider.positionValue.value).toBe(70);
});

it('ignores an already sampled intermediate packet delivered after the final packet', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  flushJS();
  flushFrame();
  const oldSample = mockJSQueue.splice(0);
  stream.move(160);
  stream.up(160);
  flushJS();
  act(() => oldSample.forEach(deliver => deliver()));
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onValueChange).toHaveBeenLastCalledWith(70);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
});

it('acknowledges an unchanged final value without waiting for another React render', () => {
  const slider = mountLatest({ value: 100 });
  const stream = slider.stream();
  stream.down(220);
  stream.up(220);
  slider.rerender({ value: 80 });
  expect(slider.positionValue.value).toBe(80);
});

it('does not let an old final packet cancel the next gesture frame before it is sampled', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  stream.up(70);
  const oldPackets = mockJSQueue.splice(0);
  stream.down(160);
  flushJS(); // New session has requested a frame but has not been sampled.
  expect(frames.size).toBe(1);
  act(() => oldPackets.forEach(deliver => deliver()));
  expect(frames.size).toBe(1);
  flushFrame();
  flushJS();
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onValueChange).toHaveBeenLastCalledWith(70);
});

it('finishes cancellation once with the final position and does not rewind the next gesture', () => {
  const slider = mountLatest();
  mockQueueJS = true;
  const stream = slider.stream();
  stream.down(70);
  stream.move(160);
  stream.cancel();
  const oldPackets = mockJSQueue.splice(0);
  stream.down(120);
  stream.move(100);
  flushJS();
  flushFrame();
  flushJS();
  act(() => oldPackets.forEach(deliver => deliver()));
  expect(slider.positionValue.value).toBe(40);
  expect(slider.props.onValueChange).toHaveBeenLastCalledWith(40);
  stream.cancel();
  flushJS();
  expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledWith(40);
});

it.each([{ disabled: true }, { maximumValue: 40 }])(
  'invalidates delayed reads on configuration changes: %j',
  next => {
    const slider = mountLatest();
    mockQueueJS = true;
    slider.stream().down(70);
    flushJS();
    flushFrame();
    slider.rerender(next);
    flushJS();
    expect(slider.props.onValueChange).not.toHaveBeenCalled();
    expect(slider.props.onSlidingStart).not.toHaveBeenCalled();
  },
);

it('releases a started owner and drops pending packets after unmount', () => {
  const slider = mountLatest();
  const stream = slider.stream();
  stream.down(70);
  flushFrame();
  expect(slider.props.onValueChange).toHaveBeenCalledWith(25);
  mockQueueJS = true;
  stream.move(160);
  slider.ui.unmount();
  flushJS();
  flushFrame();
  expect(slider.props.onValueChange).toHaveBeenCalledTimes(1);
  expect(slider.props.onSlidingComplete).toHaveBeenCalledTimes(1);
});

it('omits both built-in tracks when custom artwork is used', () => {
  const slider = mountLatest({
    minimumTrackTintColor: 'red',
    maximumTrackTintColor: 'blue',
  });
  const colors = slider.ui
    .UNSAFE_getAllByType(View)
    .map(
      node =>
        require('react-native').StyleSheet.flatten(node.props.style)
          ?.backgroundColor,
    );
  expect(colors).not.toContain('red');
  expect(colors).not.toContain('blue');
});
