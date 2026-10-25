import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';
import { Slider } from '@rneui/themed';
import {
  nativeBoundary,
  type PanBoundary,
  type PanEvent,
} from '@/testUtils/linkedPagerNativeBoundary';

// The actual pager, fixture and state ownership stay real. These boundaries
// execute gesture callbacks and animation completions, not native arbitration.
jest.mock('react-native-gesture-handler', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createGestureBoundary(),
);
jest.mock('react-native-reanimated', () => ({
  ...require('@/testUtils/linkedPagerNativeBoundary').createReanimatedBoundary(),
  measure: (ref: unknown) => mockMeasure(ref),
}));
jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@rneui/base', () => ({ Text: require('react-native').Text }));
jest.mock('@rneui/themed', () => ({
  Slider: function NativeSliderBoundary(props: object) {
    return require('react').createElement(require('react-native').View, props);
  },
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import DevUIRootSubScreen from './DevUIRootSubScreen';
// Keep the package's pure motion contracts in the app's ordinary CI test lane.
import '../../../../../packages/rn-collapsible-scene-view/src/rootScenePagerModel.test';

const WIDTH = 320;
const hidden = { includeHiddenElements: true };
const node = (suffix: string) =>
  /^slider-(Swap|Bridge)$/.test(suffix)
    ? within(
        screen.getByTestId(
          `root-fixture-slider-block-${suffix.slice('slider-'.length)}`,
          hidden,
        ),
      ).UNSAFE_getByType(Slider)
    : screen.getByTestId(`root-fixture-${suffix}`, hidden);
const pan = () => node('pan').props.gesture as PanBoundary;
const trackX = () =>
  StyleSheet.flatten(node('track').props.style).transform[0].translateX;
const finish = () => act(() => nativeBoundary.finishAnimations());
const select = (key: string) => fireEvent.press(node(`select-${key}`));
const event = (translationX = 0, velocityX = 0): PanEvent => ({
  translationX,
  translationY: 0,
  velocityX,
  x: 160,
  y: 300,
  absoluteX: 160,
  absoluteY: 300,
});
const down = (absoluteY = 300) => {
  const gesture = pan();
  const manager = { fail: jest.fn(), activate: jest.fn(), end: jest.fn() };
  act(() => {
    gesture.touchesDown?.(
      {
        allTouches: [
          { x: 160, y: absoluteY, absoluteX: 160, absoluteY },
        ] as Array<{ x: number; y: number }>,
        numberOfTouches: 1,
      },
      manager,
    );
  });
  return { gesture, manager };
};
const swipe = (translationX: number) => {
  const { gesture, manager } = down();
  expect(manager.fail).not.toHaveBeenCalled();
  act(() => {
    gesture.handlers.onStart(event(Math.sign(translationX) * 24));
    gesture.handlers.onUpdate(event(translationX));
    gesture.handlers.onEnd(event(translationX), true);
    gesture.handlers.onFinalize(event(translationX), true);
  });
};
const mockMeasure = jest.fn((ref: unknown) => {
  const host = (
    ref as { current?: { testID?: string; props?: { testID?: string } } }
  ).current;
  const testID = host?.testID ?? host?.props?.testID;
  if (!testID) {
    return null;
  }
  const slider = testID.includes('-slider-block-');
  return {
    x: 0,
    y: slider ? 144 : 80,
    width: WIDTH,
    height: slider ? 80 : 48,
    pageX: (testID.endsWith('Bridge') ? WIDTH : 0) + trackX(),
    pageY: slider ? 144 : 80,
  };
});

function mount() {
  render(<DevUIRootSubScreen />, {
    createNodeMock: element => ({ testID: element.props.testID }),
  });
  fireEvent(node('viewport'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
  });
}

beforeEach(() => {
  nativeBoundary.reset();
  mockMeasure.mockClear();
});

afterEach(cleanup);

describe('Root SubScreen playground component contract', () => {
  it('retains both native vertical owners and independent local form state', () => {
    mount();
    const swapScroll = node('scroll-Swap');
    const bridgeScroll = node('scroll-Bridge');
    expect(screen.UNSAFE_getAllByType(ScrollView)).toHaveLength(2);
    expect(swapScroll.props.horizontal).not.toBe(true);
    expect(bridgeScroll.props.horizontal).not.toBe(true);
    expect(swapScroll.props.onScroll).toBeUndefined();
    expect(bridgeScroll.props.onScroll).toBeUndefined();

    fireEvent.changeText(node('input-Swap'), '1.25');
    fireEvent(node('slider-Swap'), 'valueChange', 73);
    fireEvent(swapScroll, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 280 } },
    });
    select('Bridge');
    finish();
    fireEvent.changeText(node('input-Bridge'), '9.5');
    fireEvent(node('slider-Bridge'), 'valueChange', 42);
    fireEvent(bridgeScroll, 'scrollEndDrag', {
      nativeEvent: { contentOffset: { x: 0, y: 150 } },
    });
    select('Swap');
    finish();

    expect(node('scroll-Swap')).toBe(swapScroll);
    expect(node('scroll-Bridge')).toBe(bridgeScroll);
    expect(node('input-Swap').props.value).toBe('1.25');
    expect(node('input-Bridge').props.value).toBe('9.5');
    expect(node('slider-Swap').props.value).toBe(73);
    expect(node('slider-Bridge').props.value).toBe(42);
    expect(node('state-Swap')).toHaveTextContent(/y=280/);
    expect(node('state-Bridge')).toHaveTextContent(/y=150/);
    expect(nativeBoundary.scrollTo).not.toHaveBeenCalled();
  });

  it('publishes the selected page only after its UI animation completes', () => {
    mount();
    select('Bridge');
    expect(node('status')).toHaveTextContent(/requested=Bridge settled=Swap/);
    expect(node('state-Swap')).toHaveTextContent(/selected=true/);
    expect(node('state-Bridge')).toHaveTextContent(/selected=false/);
    expect(node('input-Swap').props.editable).toBe(false);
    expect(node('input-Bridge').props.editable).toBe(false);
    expect(node('slider-Swap').props.disabled).toBe(true);
    finish();
    expect(node('status')).toHaveTextContent(/requested=Bridge settled=Bridge/);
    expect(node('input-Bridge').props.editable).toBe(true);
    expect(node('slider-Bridge').props.disabled).toBe(false);
    expect(node('page-Swap').props.pointerEvents).toBe('none');
    expect(trackX()).toBe(-WIDTH);
  });

  it('routes horizontal drags in the blank area without adding a vertical owner', () => {
    mount();
    expect(
      within(node('scroll-Swap')).getByTestId('root-fixture-blank-Swap'),
    ).toBeTruthy();
    expect(pan().config.activeOffsetX).toEqual([-20, 20]);
    expect(pan().config.failOffsetY).toEqual([-12, 12]);
    swipe(-WIDTH * 0.65);
    expect(node('status')).toHaveTextContent(/settled=Swap/);
    finish();
    expect(node('status')).toHaveTextContent(/settled=Bridge/);
    swipe(WIDTH * 0.65);
    finish();
    expect(node('status')).toHaveTextContent(/settled=Swap/);
    expect(nativeBoundary.scrollTo).not.toHaveBeenCalled();
  });

  it.each([
    ['input', 100],
    ['slider', 180],
  ] as const)(
    'vetoes DOWN inside the measured %s region, before activation',
    (control, y) => {
      mount();
      if (control === 'slider') {
        expect(
          within(node('slider-block-Swap')).UNSAFE_getByType(Slider),
        ).toBeTruthy();
      } else {
        expect(
          within(node('input-block-Swap')).getByLabelText('Swap amount'),
        ).toBeTruthy();
      }
      const { gesture, manager } = down(y);
      expect(manager.fail).toHaveBeenCalledTimes(1);
      act(() => gesture.handlers.onFinalize(event(), false));
      expect(nativeBoundary.animations()).toHaveLength(0);
      expect(trackX()).toBeCloseTo(0);
      expect(node('input-Swap').props.editable).toBe(true);
      expect(node('status')).toHaveTextContent(/settled=Swap/);
    },
  );

  it('leaves native Y enabled after a DOWN that fails before horizontal activation', () => {
    mount();
    const { gesture, manager } = down();
    expect(manager.fail).not.toHaveBeenCalled();
    act(() => gesture.handlers.onFinalize(event(), false));
    finish();
    expect(node('scroll-Swap').props.scrollEnabled).toBe(true);
    expect(node('input-Swap').props.editable).toBe(true);
    expect(node('status')).toHaveTextContent(/settled=Swap/);
    expect(nativeBoundary.scrollTo).not.toHaveBeenCalled();
  });

  it('pauses an in-flight snap at DOWN and resumes its destination after a vertical failure', () => {
    mount();
    select('Bridge');
    act(() => nativeBoundary.advanceAnimations(0.3));
    expect(trackX()).toBeCloseTo(-WIDTH * 0.3);
    const { gesture, manager } = down();
    expect(manager.fail).not.toHaveBeenCalled();
    expect(nativeBoundary.animations()).toHaveLength(0);
    expect(trackX()).toBeCloseTo(-WIDTH * 0.3);
    act(() => gesture.handlers.onFinalize(event(), false));
    expect(node('status')).toHaveTextContent(/settled=Swap/);
    finish();
    expect(node('status')).toHaveTextContent(/settled=Bridge/);
    expect(trackX()).toBe(-WIDTH);
  });

  it('honors a new request for the source while a forward snap is still moving', () => {
    mount();
    select('Bridge');
    act(() => nativeBoundary.advanceAnimations(0.4));
    select('Swap');
    expect(trackX()).toBeCloseTo(-WIDTH * 0.4);
    finish();
    expect(node('status')).toHaveTextContent(/requested=Swap settled=Swap/);
    expect(trackX()).toBeCloseTo(0);
    expect(node('input-Swap').props.editable).toBe(true);
  });

  it('preserves native scroll instances and form state when the viewport resizes', () => {
    mount();
    const swapScroll = node('scroll-Swap');
    const bridgeScroll = node('scroll-Bridge');
    select('Bridge');
    finish();
    fireEvent.changeText(node('input-Bridge'), '12.5');
    fireEvent(bridgeScroll, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { x: 0, y: 210 } },
    });
    fireEvent(node('viewport'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 480, height: 600 } },
    });
    finish();
    expect(node('scroll-Swap')).toBe(swapScroll);
    expect(node('scroll-Bridge')).toBe(bridgeScroll);
    expect(node('input-Bridge').props.value).toBe('12.5');
    expect(node('state-Bridge')).toHaveTextContent(/y=210/);
    expect(trackX()).toBe(-480);
    expect(node('input-Bridge').props.editable).toBe(true);
    expect(nativeBoundary.scrollTo).not.toHaveBeenCalled();
  });
});
