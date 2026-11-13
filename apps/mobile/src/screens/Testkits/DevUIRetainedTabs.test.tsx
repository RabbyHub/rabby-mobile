import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import {
  Animated as NativeAnimated,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {
  nativeBoundary,
  type PanBoundary,
  type PanEvent,
} from '@/testUtils/linkedPagerNativeBoundary';

// Keep the real fixture, linked model/renderer, SceneList and activity scopes.
// Only native input/animation execution is replaced; UIKit arbitration, frames
// and touch hit testing still require the physical-device acceptance scenario.
jest.mock('react-native-gesture-handler', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createGestureBoundary(),
);
jest.mock('react-native-reanimated', () =>
  require('@/testUtils/linkedPagerNativeBoundary').createReanimatedBoundary(),
);
jest.mock('react-native-pager-view', () => ({
  __esModule: true,
  default: require('react-native').View,
}));
jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@rneui/base', () => ({ Text: require('react-native').Text }));

import DevUIRetainedTabs from './DevUIRetainedTabs';
// Include the package's real pure contract in the normal mobile unit lane.
import '../../../../../packages/rn-collapsible-scene-view/src/linkedPresentationModel.test';

type NativeScrollMapping = {
  nativeEvent: {
    contentOffset: Partial<Record<'x' | 'y', NativeAnimated.Value>>;
  };
};
type NativeScrollAttachment = {
  target: unknown;
  mapping: NativeScrollMapping[];
  detach: jest.Mock;
};
const nativeAttachments: NativeScrollAttachment[] = [];
const nativeAnimated = NativeAnimated as typeof NativeAnimated & {
  attachNativeEvent: (
    target: unknown,
    eventName: string,
    mapping: NativeScrollMapping[],
  ) => { detach: () => void };
};

const hidden = { includeHiddenElements: true };
const WIDTH = 320;
const leafKeys = ['Positions', 'Orders-Basic', 'Orders-Conditional', 'Account'];
const viewport = () => screen.getByTestId('retained-viewport', hidden);
const rootTrack = () => screen.getByTestId('retained-root-track', hidden);
const childTrack = () =>
  screen.getByTestId('retained-group-Orders-track', hidden);
const list = (key: string) =>
  screen.getByTestId(`retained-rows-${key}`, hidden);
const group = () => screen.getByTestId('retained-group-Orders', hidden);
const select = (index: number) =>
  fireEvent.press(screen.getByTestId(`retained-tab-${index}`));
const finish = () => act(() => nativeBoundary.finishAnimations());
const layout = (width = WIDTH) => {
  const event = { nativeEvent: { layout: { x: 0, y: 0, width, height: 600 } } };
  const outer = screen
    .UNSAFE_getAllByType(ScrollView)
    .find(view => !view.props.horizontal)!;
  if (outer.props.onLayout) {
    fireEvent(outer, 'layout', event);
  }
  const owner = screen.queryByTestId('retained-layout', hidden);
  if (owner?.props.onLayout) {
    fireEvent(owner, 'layout', event);
  }
  if (viewport().props.onLayout) {
    fireEvent(viewport(), 'layout', event);
  }
};
const switchMode = () => {
  fireEvent.press(screen.getByTestId('retained-toggle-mode'));
  layout();
};
const pan = () =>
  screen.getByTestId('retained-pan', hidden).props.gesture as PanBoundary;
const panEvent = (translationX = 0, y = 150, velocityX = 0): PanEvent => ({
  translationX,
  translationY: 0,
  velocityX,
  x: WIDTH / 2,
  y,
  absoluteX: WIDTH / 2,
  absoluteY: y,
});
const touchDown = (gesture = pan(), y = 150) => {
  const manager = { fail: jest.fn(), activate: jest.fn(), end: jest.fn() };
  act(() => {
    gesture.touchesDown?.(
      { allTouches: [{ x: WIDTH / 2, y }], numberOfTouches: 1 },
      manager,
    );
  });
  return manager;
};
const begin = (direction: 'left' | 'right' = 'left', y = 150) => {
  const gesture = pan();
  touchDown(gesture, y);
  act(() => {
    gesture.handlers.onBegin?.(panEvent(0, y));
    gesture.handlers.onStart(panEvent(direction === 'left' ? -24 : 24, y));
  });
  return gesture;
};
const move = (gesture: PanBoundary, fraction: number, y = 150) =>
  act(() => gesture.handlers.onUpdate(panEvent(-fraction * WIDTH, y)));
const release = (gesture: PanBoundary, fraction: number, y = 150) => {
  act(() => {
    gesture.handlers.onUpdate(panEvent(-fraction * WIDTH, y));
    gesture.handlers.onEnd(panEvent(-fraction * WIDTH, y), true);
    gesture.handlers.onFinalize(panEvent(-fraction * WIDTH, y), true);
  });
};
const cancel = (gesture: PanBoundary, fraction: number) =>
  act(() => gesture.handlers.onFinalize(panEvent(-fraction * WIDTH), false));
const swipe = (fraction: number, y = 150) => {
  const gesture = begin(fraction >= 0 ? 'left' : 'right', y);
  move(gesture, fraction, y);
  release(gesture, fraction, y);
  finish();
};
const translateX = (element: ReturnType<typeof rootTrack>) => {
  const style = StyleSheet.flatten(element.props.style);
  const values = style.transform as Array<{ translateX?: number }> | undefined;
  return values?.find(value => value.translateX !== undefined)?.translateX ?? 0;
};
const tick = () => act(() => jest.advanceTimersByTime(100));
const expectRevision = (index: number, revision: number) =>
  expect(
    within(screen.getByTestId(`retained-row-${index}-1`, hidden)).getByText(
      new RegExp(`tick ${revision}$`),
      hidden,
    ),
  ).toBeTruthy();
const inspect = () => {
  fireEvent.press(screen.getByText('Inspect'));
  return JSON.parse(screen.getByTestId('retained-report').props.children) as {
    selected: string;
    pagingMode: 'flat' | 'nested';
    pill: string;
    source: number;
    pages: Array<{
      key: string;
      fixtureRows: number;
      rowMounts: number;
      rowUnmounts: number;
      rowRenders: number;
    }>;
  };
};
const measurePage = (path: string[], height: number) =>
  fireEvent(
    screen.getByTestId(`retained-content-${JSON.stringify(path)}`, hidden),
    'layout',
    {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height } },
    },
  );
const measureHeader = (height = 60) => {
  const header = group();
  let owner = header;
  while (!owner.props.onLayout && owner.parent) {
    owner = owner.parent;
  }
  fireEvent(owner, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height } },
  });
};

describe.each(['flat', 'nested'] as const)(
  'DevUIRetainedTabs logical-flat / visual-nested component (%s)',
  mode => {
    const setup = (onBack = jest.fn()) => {
      const fixture = render(<DevUIRetainedTabs onBack={onBack} />);
      if (mode === 'nested') {
        switchMode();
      } else {
        layout();
      }
      measureHeader();
      measurePage(['Positions'], 1800);
      measurePage(['Orders', 'Basic'], 1300);
      measurePage(['Orders', 'Conditional'], 400);
      measurePage(['Account'], 1800);
      return fixture;
    };
    beforeEach(() => {
      jest.useFakeTimers();
      jest.replaceProperty(Platform, 'OS', 'ios');
      nativeBoundary.reset();
      nativeAttachments.length = 0;
      jest
        .spyOn(ScrollView.prototype, 'getNativeScrollRef')
        .mockImplementation(function (this: ScrollView) {
          return this as never;
        });
      jest
        .spyOn(nativeAnimated, 'attachNativeEvent')
        .mockImplementation((target, _eventName, mapping) => {
          const attachment = { target, mapping, detach: jest.fn() };
          nativeAttachments.push(attachment);
          return attachment;
        });
    });
    afterEach(() => {
      cleanup();
      nativeBoundary.reset();
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('retains four leaves under one Pan, one vertical owner and separate trade chrome', () => {
      setup();
      const leaves = leafKeys.map(list);
      const header = screen.getByTestId('retained-header');
      expect(inspect().pagingMode).toBe(mode);
      expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
      expect(screen.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
      expect(
        screen.UNSAFE_getAllByType(ScrollView)[0].props.horizontal,
      ).toBeFalsy();
      expect(screen.getAllByTestId('retained-pan', hidden)).toHaveLength(1);
      expect(
        within(viewport()).queryByTestId('retained-header', hidden),
      ).toBeNull();
      expect(
        screen.getAllByTestId('retained-pill-controls', hidden),
      ).toHaveLength(1);
      for (const index of [1, 2, 0]) {
        select(index);
        finish();
      }
      leafKeys.forEach((key, index) => expect(list(key)).toBe(leaves[index]));
      expect(screen.getByTestId('retained-header')).toBe(header);
      fireEvent.press(screen.getByTestId('retained-trade'));
      expect(screen.getByText('Trade button: 1')).toBeTruthy();
    });

    it('uses the Orders ancestor for header and rows, never an independent horizontal follower', () => {
      setup();
      const ordersRoot = screen.getByTestId('retained-root-Orders', hidden);
      const controls = screen.getByTestId('retained-pill-controls', hidden);
      expect(
        within(rootTrack()).getByTestId('retained-root-Orders', hidden),
      ).toBe(ordersRoot);
      expect(
        within(ordersRoot).getByTestId('retained-pill-controls', hidden),
      ).toBe(controls);
      expect(
        within(ordersRoot).getByTestId('retained-rows-Orders-Basic', hidden),
      ).toBe(list('Orders-Basic'));
      expect(
        within(ordersRoot).getByTestId(
          'retained-rows-Orders-Conditional',
          hidden,
        ),
      ).toBe(list('Orders-Conditional'));
      expect(
        within(childTrack()).queryByTestId('retained-pill-controls', hidden),
      ).toBeNull();
      expect(
        nativeAttachments
          .flatMap(item => item.mapping)
          .some(item => item.nativeEvent.contentOffset.x !== undefined),
      ).toBe(false);
      expect(
        nativeAttachments
          .flatMap(item => item.mapping)
          .some(item => item.nativeEvent.contentOffset.y !== undefined),
      ).toBe(true);
      select(1);
      finish();
      fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
      finish();
      select(2);
      finish();
      expect(screen.getByTestId('retained-pill-controls', hidden)).toBe(
        controls,
      );
    });

    it('commits only completed child selection and remembers it when returning to Orders', () => {
      setup();
      select(1);
      expect(inspect().selected).toBe('Positions');
      finish();
      fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
      expect(
        screen.getByTestId('retained-pill-selection', hidden),
      ).toHaveTextContent('Orders: Basic');
      finish();
      expect(screen.getByTestId('retained-pill-selection')).toHaveTextContent(
        'Orders: Conditional',
      );
      expect(screen.getByTestId('retained-selection')).toHaveTextContent(
        'Retained linked tabs: Orders',
      );
      select(2);
      finish();
      select(1);
      finish();
      expect(inspect()).toMatchObject({
        selected: 'Orders',
        pill: 'Conditional',
      });
    });

    describe.each([
      { child: 'Basic', childIndex: 0, away: 'Account', awayIndex: 2 },
      {
        child: 'Conditional',
        childIndex: 1,
        away: 'Positions',
        awayIndex: 0,
      },
    ] as const)('restoring remembered $child from $away', scenario => {
      it.each(['swipe', 'click'] as const)(
        'keeps header and child preview on the remembered leaf during a root %s',
        trigger => {
          setup();
          select(1);
          finish();
          if (scenario.child === 'Conditional') {
            fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
            finish();
          }
          select(scenario.awayIndex);
          finish();

          const expectRememberedPreview = () => {
            expect(translateX(childTrack())).toBeCloseTo(
              -scenario.childIndex * WIDTH,
            );
            expect(
              screen.getByTestId('retained-pill-selection', hidden),
            ).toHaveTextContent(`Orders: ${scenario.child}`);
            expect(inspect()).toMatchObject({
              selected: scenario.away,
              pill: scenario.child,
            });
          };
          expectRememberedPreview();

          if (trigger === 'swipe') {
            const direction = scenario.awayIndex === 2 ? -1 : 1;
            const gesture = begin(direction < 0 ? 'right' : 'left');
            // Catch a wrong child at the very first revealed frame, not merely
            // a final selection corrected after the root animation finishes.
            expectRememberedPreview();
            move(gesture, direction * 0.4);
            expectRememberedPreview();
            expect(translateX(rootTrack())).toBeCloseTo(
              -(scenario.awayIndex + direction * 0.4) * WIDTH,
            );
            release(gesture, direction * 0.7);
          } else {
            select(1);
            expectRememberedPreview();
          }
          act(() => nativeBoundary.advanceAnimations(0.5));
          expectRememberedPreview();
          finish();
          expect(inspect()).toMatchObject({
            selected: 'Orders',
            pill: scenario.child,
          });
          expect(translateX(rootTrack())).toBeCloseTo(-WIDTH);
          expect(translateX(childTrack())).toBeCloseTo(
            -scenario.childIndex * WIDTH,
          );
          expect(
            screen.getByTestId('retained-pill-selection'),
          ).toHaveTextContent(`Orders: ${scenario.child}`);
        },
      );
    });

    it('uses the same completed-animation contract on Android', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      setup();
      select(1);
      expect(inspect().selected).toBe('Positions');
      finish();
      expect(inspect().selected).toBe('Orders');
    });

    it('explicitly remounts mode/account ownership and preserves the selected leaf', () => {
      setup();
      select(1);
      finish();
      fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
      finish();
      const before = rootTrack();
      switchMode();
      expect(rootTrack()).not.toBe(before);
      expect(inspect()).toMatchObject({
        pagingMode: mode === 'flat' ? 'nested' : 'flat',
        selected: 'Orders',
        pill: 'Conditional',
      });
      const switched = rootTrack();
      fireEvent.press(screen.getByTestId('retained-reset-account'));
      layout();
      expect(rootTrack()).not.toBe(switched);
      expect(inspect()).toMatchObject({
        selected: 'Orders',
        pill: 'Conditional',
      });
    });

    it('retains measured rows and the long/short/append fixture controls', () => {
      setup();
      leafKeys.forEach(key =>
        expect(
          StyleSheet.flatten(list(key).props.style).height,
        ).toBeUndefined(),
      );
      expect(inspect().pages.map(page => page.fixtureRows)).toEqual([
        120, 80, 100,
      ]);
      fireEvent.press(screen.getByText('Long C'));
      fireEvent.press(screen.getByText('+3 B'));
      expect(inspect().pages.map(page => page.fixtureRows)).toEqual([
        120, 83, 4,
      ]);
      select(2);
      finish();
      expect(screen.queryByTestId('retained-row-2-5', hidden)).toBeNull();
      expect(screen.getByTestId('retained-row-2-4', hidden)).toBeTruthy();
    });

    it('catches up only the preview neighbour then re-pauses it after cancellation', () => {
      setup();
      fireEvent.press(screen.getByText('Feed'));
      tick();
      expectRevision(0, 1);
      expectRevision(1, 0);
      expectRevision(2, 0);
      expectRevision(3, 0);
      const gesture = begin();
      move(gesture, 0.4);
      expectRevision(1, 1);
      tick();
      expectRevision(1, 2);
      cancel(gesture, 0.4);
      finish();
      tick();
      expectRevision(0, 3);
      expectRevision(1, 2);
      expectRevision(2, 0);
      expectRevision(3, 0);
      fireEvent.press(screen.getByText('Stop'));
      tick();
      expect(inspect().source).toBe(3);
    });

    it('routes Deep/Top only to the native vertical handle, never during horizontal transitions', () => {
      const scrollToOffset = jest
        .spyOn(FlatList.prototype, 'scrollToOffset')
        .mockImplementation(() => undefined);
      const onBack = jest.fn();
      setup(onBack);
      expect(scrollToOffset).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText('Deep'));
      fireEvent.press(screen.getByText('Top'));
      expect(scrollToOffset.mock.calls).toEqual([
        [{ offset: 4000, animated: false }],
        [{ offset: 0, animated: false }],
      ]);
      select(1);
      finish();
      swipe(0.7);
      expect(scrollToOffset).toHaveBeenCalledTimes(2);
      expect(nativeBoundary.scrollTo).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText('Back'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('serializes rapid commands and coalesces queued requests to the latest destination', () => {
      setup();
      select(1);
      select(0);
      select(2);
      expect(nativeBoundary.animations()).toHaveLength(1);
      act(() => nativeBoundary.finishNextAnimation());
      expect(inspect().selected).toBe('Orders');
      expect(nativeBoundary.animations()).toHaveLength(1);
      finish();
      expect(inspect().selected).toBe('Account');
    });

    it('moves one visual hierarchy at a time while keeping shared controls with the root', () => {
      setup();
      measureHeader();
      const rootGesture = begin();
      move(rootGesture, 0.4);
      expect(translateX(rootTrack())).toBeCloseTo(-WIDTH * 0.4);
      expect(translateX(childTrack())).toBeCloseTo(0);
      release(rootGesture, 0.7);
      finish();
      expect(inspect().selected).toBe('Orders');
      const childGesture = begin('left', 150);
      move(childGesture, 0.4);
      expect(translateX(rootTrack())).toBeCloseTo(-WIDTH);
      expect(translateX(childTrack())).toBeCloseTo(-WIDTH * 0.4);
      release(childGesture, 0.7);
      finish();
      expect(inspect().pill).toBe('Conditional');
    });

    it('allows swiping the retained blank area, not only populated row children', () => {
      setup();
      measureHeader();
      select(1);
      finish();
      const before = list('Orders-Conditional');
      swipe(0.7, 520);
      expect(inspect()).toMatchObject({
        selected: 'Orders',
        pill: 'Conditional',
      });
      expect(list('Orders-Conditional')).toBe(before);
    });

    it('ignores a vertical/tap failure before activation and recovers a cancelled active drag', () => {
      setup();
      act(() => pan().handlers.onFinalize(panEvent(), false));
      expect(nativeBoundary.animations()).toHaveLength(0);
      const gesture = begin();
      move(gesture, 0.4);
      cancel(gesture, 0.4);
      expect(inspect().selected).toBe('Positions');
      finish();
      expect(translateX(rootTrack())).toBeCloseTo(0);
      select(1);
      finish();
      expect(inspect().selected).toBe('Orders');
    });

    it.each(['end', 'cancel'] as const)(
      'restores interaction when a preview reverses beyond the outer boundary then %ss',
      completion => {
        setup();
        const gesture = begin();
        move(gesture, 0.4);
        move(gesture, -0.4);
        if (completion === 'end') {
          release(gesture, -0.4);
        } else {
          cancel(gesture, -0.4);
        }
        finish();
        expect(inspect().selected).toBe('Positions');
        expect(
          screen.getByTestId('retained-page-["Positions"]', hidden).props
            .pointerEvents,
        ).toBe('auto');
        expect(nativeBoundary.animations()).toHaveLength(0);
        select(2);
        finish();
        expect(inspect().selected).toBe('Account');
      },
    );

    it('chooses the first actual movement after an iOS zero-translation activation', () => {
      setup();
      const gesture = pan();
      const manager = { fail: jest.fn(), activate: jest.fn(), end: jest.fn() };
      act(() => {
        gesture.touchesDown?.(
          { allTouches: [{ x: WIDTH / 2, y: 150 }], numberOfTouches: 1 },
          manager,
        );
        gesture.handlers.onStart(panEvent(0));
      });
      expect(manager.fail).not.toHaveBeenCalled();
      move(gesture, 0.4);
      expect(translateX(rootTrack())).toBeCloseTo(-WIDTH * 0.4);
      release(gesture, 0.7);
      finish();
      expect(inspect().selected).toBe('Orders');
    });

    it('takes over a pending settle without rounding or allowing its stale completion to commit', () => {
      setup();
      const first = begin();
      move(first, 0.7);
      release(first, 0.7);
      act(() => nativeBoundary.advanceAnimations(0.5));
      const before = translateX(rootTrack());
      const old = nativeBoundary.animations()[0];
      const second = begin('right');
      expect(old.cancelled).toBe(true);
      expect(translateX(rootTrack())).toBeCloseTo(before);
      act(() => old.callback?.(true, old.target));
      expect(inspect().selected).toBe('Positions');
      move(second, -0.8);
      release(second, -0.8);
      finish();
      expect(inspect().selected).toBe('Positions');
      expect(translateX(rootTrack())).toBeCloseTo(0);
    });

    describe.each([0, 1] as const)(
      'interrupting a snap toward endpoint %i',
      endpoint => {
        const pendingSnap = () => {
          setup();
          const gesture = begin();
          const distance = endpoint === 0 ? 0.2 : 0.7;
          move(gesture, distance);
          release(gesture, distance);
          expect(nativeBoundary.animations()).toHaveLength(1);
          const task = nativeBoundary.animations()[0];
          expect(task.target).toBe(endpoint);
          act(() => nativeBoundary.advanceAnimations(0.5));
          return task;
        };

        it('pauses on DOWN and cannot complete before the replacement gesture becomes ACTIVE', () => {
          const old = pendingSnap();
          const before = translateX(rootTrack());
          const oldCallback = jest.fn(old.callback);
          old.callback = oldCallback;
          const gesture = pan();
          expect(touchDown(gesture).fail).not.toHaveBeenCalled();
          expect(old.cancelled).toBe(true);
          expect(oldCallback).toHaveBeenCalledWith(false, expect.any(Number));
          expect(nativeBoundary.animations()).toHaveLength(0);
          // Defensive injection, not a claim that Reanimated emits success after
          // cancellation: the old transaction must not own the new DOWN epoch.
          act(() => old.callback?.(true, old.target));
          finish();
          expect(inspect().selected).toBe('Positions');
          expect(translateX(rootTrack())).toBeCloseTo(before);
          act(() => gesture.handlers.onStart(panEvent(-24)));
          expect(translateX(rootTrack())).toBeCloseTo(before);
          move(gesture, 0.7);
          release(gesture, 0.7);
          finish();
          expect(inspect().selected).toBe('Orders');
        });

        it('resumes the saved endpoint when DOWN ends as a tap or vertical failure before ACTIVE', () => {
          const old = pendingSnap();
          const before = translateX(rootTrack());
          const gesture = pan();
          touchDown(gesture);
          expect(old.cancelled).toBe(true);
          expect(translateX(rootTrack())).toBeCloseTo(before);
          act(() => gesture.handlers.onFinalize(panEvent(), false));
          expect(nativeBoundary.animations()).toHaveLength(1);
          expect(nativeBoundary.animations()[0].target).toBe(endpoint);
          // Deliberately replay the old completion to verify ownership fencing.
          act(() => old.callback?.(true, old.target));
          expect(inspect().selected).toBe('Positions');
          expect(translateX(rootTrack())).toBeCloseTo(before);
          finish();
          expect(inspect().selected).toBe(
            endpoint === 1 ? 'Orders' : 'Positions',
          );
          expect(translateX(rootTrack())).toBeCloseTo(-endpoint * WIDTH);
          expect(nativeBoundary.animations()).toHaveLength(0);
        });

        it('restores the interrupted snap target after an ACTIVE takeover is system-cancelled', () => {
          const old = pendingSnap();
          const gesture = begin('right');
          expect(old.cancelled).toBe(true);
          move(gesture, -0.15);
          cancel(gesture, -0.15);
          expect(nativeBoundary.animations()).toHaveLength(1);
          expect(nativeBoundary.animations()[0].target).toBe(endpoint);
          finish();
          expect(inspect().selected).toBe(
            endpoint === 1 ? 'Orders' : 'Positions',
          );
          expect(translateX(rootTrack())).toBeCloseTo(-endpoint * WIDTH);
          const selectedPath =
            endpoint === 1 ? '["Orders","Basic"]' : '["Positions"]';
          expect(
            screen.getByTestId(`retained-page-${selectedPath}`, hidden).props
              .pointerEvents,
          ).toBe('auto');
        });
      },
    );

    it('holds measured source height during a swipe and applies the destination height only at completion', () => {
      setup();
      measurePage(['Positions'], 1800);
      measurePage(['Account'], 100);
      expect(StyleSheet.flatten(viewport().props.style).height).toBe(1800);
      select(2);
      act(() => nativeBoundary.advanceAnimations(0.5));
      expect(StyleSheet.flatten(viewport().props.style).height).toBe(1800);
      finish();
      expect(StyleSheet.flatten(viewport().props.style).height).toBeLessThan(
        1800,
      );
      select(0);
      finish();
      expect(StyleSheet.flatten(viewport().props.style).height).toBe(1800);
    });

    it('cancels resize-invalidated motion while retaining the outer vertical owner', () => {
      setup();
      const outer = screen.UNSAFE_getAllByType(ScrollView)[0];
      select(2);
      const old = nativeBoundary.animations()[0];
      layout(WIDTH + 100);
      expect(inspect().selected).toBe('Positions');
      expect(screen.UNSAFE_getAllByType(ScrollView)[0]).toBe(outer);
      act(() => old.callback?.(true, old.target));
      expect(inspect().selected).toBe('Positions');
      select(1);
      finish();
      expect(inspect().selected).toBe('Orders');
    });

    if (mode === 'flat') {
      it('can reverse across the Basic origin without moving root and child together', () => {
        setup();
        measureHeader();
        select(1);
        finish();
        const gesture = begin();
        move(gesture, 0.4);
        expect(translateX(rootTrack())).toBe(-WIDTH);
        expect(translateX(childTrack())).toBeCloseTo(-WIDTH * 0.4);
        move(gesture, -0.4);
        expect(translateX(rootTrack())).toBeCloseTo(-WIDTH * 0.6);
        expect(translateX(childTrack())).toBeCloseTo(0);
        release(gesture, -0.7);
        finish();
        expect(inspect().selected).toBe('Positions');
      });

      it('keeps Conditional visible at its boundary, then moves its entire Orders root toward Account', () => {
        setup();
        select(1);
        finish();
        swipe(0.7);
        const gesture = begin();
        move(gesture, 0.4);
        expect(translateX(rootTrack())).toBeCloseTo(-WIDTH * 1.4);
        expect(translateX(childTrack())).toBe(-WIDTH);
        release(gesture, 0.7);
        finish();
        expect(inspect().selected).toBe('Account');
        swipe(-0.7);
        expect(inspect()).toMatchObject({
          selected: 'Orders',
          pill: 'Conditional',
        });
      });
    } else {
      it('clears a child preview after reversing beyond Basic and cancelling', () => {
        setup();
        select(1);
        finish();
        const gesture = begin();
        move(gesture, 0.4);
        move(gesture, -0.4);
        cancel(gesture, -0.4);
        finish();
        expect(inspect()).toMatchObject({ selected: 'Orders', pill: 'Basic' });
        expect(
          screen.getByTestId('retained-page-["Orders","Basic"]', hidden).props
            .pointerEvents,
        ).toBe('auto');
        expect(translateX(childTrack())).toBeCloseTo(0);
        fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
        finish();
        expect(inspect().pill).toBe('Conditional');
      });

      it('uses precise child hit testing without handing a child edge to its parent', () => {
        setup();
        measureHeader();
        select(1);
        finish();
        swipe(-0.7, 150);
        expect(inspect()).toMatchObject({ selected: 'Orders', pill: 'Basic' });
        swipe(0.7, 150);
        expect(inspect().pill).toBe('Conditional');
        swipe(0.7, 150);
        expect(inspect()).toMatchObject({
          selected: 'Orders',
          pill: 'Conditional',
        });
        // The group controls belong to the root surface, not child rows.
        swipe(0.7, 20);
        expect(inspect().selected).toBe('Account');
      });
    }

    it('cleans Feed timers, native Y attachment and pending animation on unmount', () => {
      const intervals = jest.spyOn(global, 'setInterval');
      const clearInterval = jest.spyOn(global, 'clearInterval');
      const fixture = setup();
      fireEvent.press(screen.getByText('Feed'));
      tick();
      const feedCall = intervals.mock.calls.findIndex(
        ([, delay]) => delay === 100,
      );
      const feedTimer = intervals.mock.results[feedCall].value;
      select(1);
      const old = nativeBoundary.animations()[0];
      fixture.unmount();
      expect(clearInterval).toHaveBeenCalledWith(feedTimer);
      expect(
        nativeAttachments.every(item => item.detach.mock.calls.length === 1),
      ).toBe(true);
      expect(old.cancelled).toBe(true);
      act(() => old.callback?.(true, old.target));
      expect(nativeBoundary.animations()).toHaveLength(0);
    });
  },
);
