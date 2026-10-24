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

const mockSetPage = jest.fn();
const mockNativeScrollTo = jest.fn();

type NativeScrollMapping = {
  nativeEvent: {
    contentOffset: Partial<Record<'x' | 'y', NativeAnimated.Value>>;
  };
};
type NativeScrollAttachment = {
  target: unknown;
  eventName: string;
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

type HeaderPanEvent = { translationX: number; velocityX: number };
type HeaderPanManager = { fail: () => void };
type HeaderPanBoundary = {
  config: Record<string, unknown>;
  handlers: Record<string, (event: HeaderPanEvent, success?: boolean) => void>;
  touchesDown?: (event: unknown, manager: HeaderPanManager) => void;
};

// Keep the real fixture, linked model/renderer, SceneList and activity scopes.
// These native callback boundaries do not prove UIKit gesture arbitration.
jest.mock('react-native-pager-view', () => {
  const ReactModule = require('react') as typeof React;
  const NativeView = require('react-native').View;
  return {
    __esModule: true,
    default: ReactModule.forwardRef(function NativePagerBoundary(
      props: React.PropsWithChildren<Record<string, unknown>>,
      ref: React.Ref<unknown>,
    ) {
      ReactModule.useImperativeHandle(
        ref,
        () => ({ setPage: mockSetPage }),
        [],
      );
      return <NativeView {...props} />;
    }),
  };
});
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  const pan = () => {
    const boundary: HeaderPanBoundary & Record<string, unknown> = {
      config: {},
      handlers: {},
    };
    for (const name of [
      'enabled',
      'activeOffsetX',
      'failOffsetY',
      'maxPointers',
      'runOnJS',
    ]) {
      boundary[name] = (value: unknown) => {
        boundary.config[name] = value;
        return boundary;
      };
    }
    for (const name of [
      'onBegin',
      'onStart',
      'onUpdate',
      'onEnd',
      'onFinalize',
    ]) {
      boundary[name] = (handler: HeaderPanBoundary['handlers'][string]) => {
        boundary.handlers[name] = handler;
        return boundary;
      };
    }
    boundary.onTouchesDown = (
      handler: NonNullable<HeaderPanBoundary['touchesDown']>,
    ) => {
      boundary.touchesDown = handler;
      return boundary;
    };
    return boundary;
  };
  return {
    Pressable: native.Pressable,
    Text: native.Text,
    TextInput: native.TextInput,
    Gesture: { Pan: pan },
    GestureDetector: ({
      children,
      gesture,
    }: React.PropsWithChildren<{ gesture: HeaderPanBoundary }>) =>
      ReactModule.createElement(
        native.View,
        { testID: 'native-header-pan-boundary', gesture },
        children,
      ),
  };
});
jest.mock('react-native-animateable-text', () => require('react-native').Text);
jest.mock('@rneui/base', () => ({ Text: require('react-native').Text }));
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof React;
  const native = require('react-native');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: unknown) => component,
      View: native.View,
      ScrollView: native.ScrollView,
    },
    useSharedValue: (value: unknown) => ReactModule.useRef({ value }).current,
    useAnimatedStyle: (style: () => unknown) => style(),
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const callback = (instance: unknown) => {
          callback.current = instance;
        };
        callback.current = null as unknown;
        return callback;
      }, []),
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (current: unknown, previous: unknown) => void,
      dependencies: React.DependencyList = [],
    ) => {
      const previous = ReactModule.useRef<unknown>(null);
      ReactModule.useEffect(() => {
        const current = prepare();
        react(current, previous.current);
        previous.current = current;
      }, dependencies);
    },
    // Reanimated multiplexes native scroll lifecycle events through onScroll.
    useAnimatedScrollHandler:
      (handlers: Record<string, (event: unknown) => void>) =>
      (event: { nativeEvent: unknown; eventName?: string }) =>
        handlers[event.eventName ?? 'onScroll']?.(event.nativeEvent),
    useEvent: (handler: unknown) => handler,
    runOnUI: (callback: unknown) => callback,
    runOnJS: (callback: unknown) => callback,
    // Jest hoists the module factory before this file's spy initialization.
    // Resolve the spy only when the production worklet invokes the boundary.
    scrollTo: (...args: unknown[]) => mockNativeScrollTo(...args),
  };
});

import DevUIRetainedTabs from './DevUIRetainedTabs';

const hidden = { includeHiddenElements: true };
const WIDTH = 320;
const leafKeys = ['Positions', 'Orders-Basic', 'Orders-Conditional', 'Account'];
const track = () =>
  screen.queryByTestId('retained-track', hidden) ??
  screen.getByTestId('retained-pager', hidden);
const isFlat = () => track().props.testID === 'retained-track';
const list = (key: string) =>
  screen.getByTestId(`retained-rows-${key}`, hidden);
const select = (index: number) =>
  fireEvent.press(screen.getByTestId(`retained-tab-${index}`));
const nativeScroll = (
  eventName: 'onScroll' | 'onBeginDrag' | 'onEndDrag' | 'onMomentumEnd',
  progress: number,
) =>
  fireEvent(track(), 'scroll', {
    eventName,
    nativeEvent: { contentOffset: { x: progress * WIDTH, y: 0 } },
  });
const settleRoot = (index: number) => {
  if (isFlat()) {
    nativeScroll('onMomentumEnd', index);
  } else {
    fireEvent(track(), 'pageSelected', { position: index });
  }
};
const settleConditional = () => {
  if (isFlat()) {
    nativeScroll('onMomentumEnd', 2);
  } else {
    fireEvent(
      screen.getByTestId('retained-group-Orders-pager', hidden),
      'pageSelected',
      { position: 1 },
    );
  }
};
const layoutTrack = () => {
  if (isFlat()) {
    fireEvent(track(), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
    });
    fireEvent(track(), 'contentSizeChange', WIDTH * leafKeys.length, 600);
  }
};
const switchMode = () => {
  fireEvent.press(screen.getByTestId('retained-toggle-mode'));
  layoutTrack();
};
const headerPan = () =>
  screen.getByTestId('native-header-pan-boundary', hidden).props
    .gesture as HeaderPanBoundary;
const headerPanEvent = (translationX = 0, velocityX = 0): HeaderPanEvent => ({
  translationX,
  velocityX,
});
const headerTouchDown = (gesture: HeaderPanBoundary) => {
  const manager = { fail: jest.fn() };
  expect(gesture.touchesDown).toEqual(expect.any(Function));
  act(() => gesture.touchesDown?.({}, manager));
  return manager;
};
const lastNativeScroll = () =>
  mockNativeScrollTo.mock.calls[mockNativeScrollTo.mock.calls.length - 1];
const activeNativeAttachments = (axis: 'x' | 'y') =>
  nativeAttachments.filter(
    attachment =>
      attachment.detach.mock.calls.length === 0 &&
      attachment.mapping.some(
        entry => entry.nativeEvent.contentOffset[axis] !== undefined,
      ),
  );
const groupHeaderX = () => {
  const header = screen
    .UNSAFE_getAllByType(NativeAnimated.View)
    .find(view => view.props.testID === 'retained-group-Orders-gesture')!;
  const transform = StyleSheet.flatten(header.props.style).transform as Array<{
    translateX?: number | { __getValue: () => number };
  }>;
  const translateX = transform.find(value => value.translateX !== undefined)!
    .translateX!;
  return typeof translateX === 'number' ? translateX : translateX.__getValue();
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

describe.each(['flat', 'nested'] as const)(
  'DevUIRetainedTabs shared linked component (%s)',
  mode => {
    const accountIndex = mode === 'flat' ? 3 : 2;
    const setup = (onBack = jest.fn()) => {
      const fixture = render(<DevUIRetainedTabs onBack={onBack} />);
      if (mode === 'nested') {
        switchMode();
      } else {
        layoutTrack();
      }
      mockSetPage.mockClear();
      mockNativeScrollTo.mockClear();
      return fixture;
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.replaceProperty(Platform, 'OS', 'ios');
      mockSetPage.mockClear();
      nativeAttachments.length = 0;
      // RN's Jest ScrollView returns undefined here. Model only the external
      // stable native host identity so real repository ref lifecycles execute.
      jest
        .spyOn(ScrollView.prototype, 'getNativeScrollRef')
        .mockImplementation(function (this: ScrollView) {
          return this as never;
        });
      jest
        .spyOn(nativeAnimated, 'attachNativeEvent')
        .mockImplementation((target, eventName, mapping) => {
          const attachment = {
            target,
            eventName,
            mapping,
            detach: jest.fn(),
          };
          nativeAttachments.push(attachment);
          return attachment;
        });
    });
    afterEach(() => {
      cleanup();
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('keeps all four leaves with one native vertical owner and separate header/trade', () => {
      setup();
      const leaves = leafKeys.map(list);
      const header = screen.getByTestId('retained-header');
      expect(inspect().pagingMode).toBe(mode);
      expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(5);
      expect(
        screen
          .UNSAFE_getAllByType(ScrollView)
          .filter(view => !view.props.horizontal),
      ).toHaveLength(1);
      expect(
        within(track()).queryByTestId('retained-header', hidden),
      ).toBeNull();
      expect(
        screen.getAllByTestId('retained-pill-controls', hidden),
      ).toHaveLength(1);
      for (const [logical, physical] of [
        [1, 1],
        [2, accountIndex],
        [0, 0],
      ]) {
        select(logical);
        settleRoot(physical);
      }
      leafKeys.forEach((key, index) => expect(list(key)).toBe(leaves[index]));
      expect(screen.getByTestId('retained-header')).toBe(header);
      fireEvent.press(screen.getByTestId('retained-trade'));
      expect(screen.getByText('Trade button: 1')).toBeTruthy();
    });

    it('commits child selection without changing the logical tab, then remembers it on return', () => {
      setup();
      select(1);
      settleRoot(1);
      fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
      expect(
        screen.getByTestId('retained-pill-selection', hidden),
      ).toHaveTextContent('Orders: Basic');
      settleConditional();
      expect(screen.getByTestId('retained-pill-selection')).toHaveTextContent(
        'Orders: Conditional',
      );
      expect(screen.getByTestId('retained-selection')).toHaveTextContent(
        'Retained native tabs: Orders',
      );
      select(2);
      settleRoot(accountIndex);
      select(1);
      settleRoot(mode === 'flat' ? 2 : 1);
      expect(screen.getByTestId('retained-pill-selection')).toHaveTextContent(
        'Orders: Conditional',
      );
      expect(inspect().pill).toBe('Conditional');
    });

    it('preserves Android completion ordering at the selected native boundary', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      setup();
      select(1);
      settleRoot(1);
      if (mode === 'nested') {
        expect(screen.getByTestId('retained-selection')).toHaveTextContent(
          'Retained native tabs: Positions',
        );
        fireEvent(track(), 'pageScrollStateChanged', {
          pageScrollState: 'idle',
        });
      }
      expect(screen.getByTestId('retained-selection')).toHaveTextContent(
        'Retained native tabs: Orders',
      );
    });

    it('explicitly remounts the mode and account owners while retaining the current leaf', () => {
      setup();
      select(1);
      settleRoot(1);
      fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
      settleConditional();
      const oldTrack = track();
      switchMode();
      expect(track()).not.toBe(oldTrack);
      expect(inspect().pagingMode).toBe(mode === 'flat' ? 'nested' : 'flat');
      expect(screen.getByTestId('retained-pill-selection')).toHaveTextContent(
        'Orders: Conditional',
      );
      const switched = track();
      fireEvent.press(screen.getByTestId('retained-reset-account'));
      layoutTrack();
      expect(track()).not.toBe(switched);
      expect(screen.getByTestId('retained-pill-selection')).toHaveTextContent(
        'Orders: Conditional',
      );
      expect(screen.getByTestId('retained-selection')).toHaveTextContent(
        'Retained native tabs: Orders',
      );
    });

    it('uses measured rows and retains long/short/append fixture controls', () => {
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
      const next = inspect();
      expect(next.pages.map(page => page.fixtureRows)).toEqual([120, 83, 4]);
      expect(next.pages[0].rowMounts).toBeGreaterThan(0);
      select(2);
      settleRoot(accountIndex);
      expect(screen.queryByTestId('retained-row-2-5', hidden)).toBeNull();
      expect(screen.getByTestId('retained-row-2-4', hidden)).toBeTruthy();
    });

    it('catches up only the revealed neighbour and re-pauses it after cancellation', () => {
      setup();
      fireEvent.press(screen.getByText('Feed'));
      tick();
      expectRevision(0, 1);
      expectRevision(1, 0);
      expectRevision(2, 0);
      expectRevision(3, 0);
      if (mode === 'flat') {
        nativeScroll('onBeginDrag', 0);
        nativeScroll('onScroll', 0.4);
      } else {
        fireEvent(track(), 'pageScrollStateChanged', {
          pageScrollState: 'dragging',
        });
        fireEvent(track(), 'pageScroll', { position: 0, offset: 0.4 });
      }
      expectRevision(1, 1);
      tick();
      expectRevision(1, 2);
      if (mode === 'flat') {
        nativeScroll('onScroll', 0);
        nativeScroll('onEndDrag', 0);
        nativeScroll('onMomentumEnd', 0);
      } else {
        fireEvent(track(), 'pageScroll', { position: 0, offset: 0 });
        fireEvent(track(), 'pageScrollStateChanged', {
          pageScrollState: 'idle',
        });
      }
      tick();
      expectRevision(0, 3);
      expectRevision(1, 2);
      expectRevision(2, 0);
      expectRevision(3, 0);
      fireEvent.press(screen.getByText('Stop'));
      tick();
      expect(inspect().source).toBe(3);
    });

    it('routes Deep/Top through the public vertical handle without replay on tab changes', () => {
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
      settleRoot(1);
      expect(scrollToOffset).toHaveBeenCalledTimes(2);
      fireEvent.press(screen.getByText('Back'));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('serializes rapid root requests through the real linked renderer', () => {
      const scrollTo = jest
        .spyOn(ScrollView.prototype, 'scrollTo')
        .mockImplementation(() => undefined);
      setup();
      scrollTo.mockClear();
      select(1);
      select(0);
      select(2);
      expect(
        mode === 'flat' ? scrollTo.mock.calls : mockSetPage.mock.calls,
      ).toEqual(mode === 'flat' ? [[{ x: WIDTH, animated: true }]] : [[1]]);
      settleRoot(1);
      expect(
        mode === 'flat' ? scrollTo.mock.calls : mockSetPage.mock.calls,
      ).toEqual(
        mode === 'flat'
          ? [
              [{ x: WIDTH, animated: true }],
              [{ x: accountIndex * WIDTH, animated: true }],
            ]
          : [[1], [accountIndex]],
      );
      settleRoot(accountIndex);
      expect(screen.getByTestId('retained-selection')).toHaveTextContent(
        'Retained native tabs: Account',
      );
    });

    if (mode === 'flat') {
      it('attaches shared header X to the horizontal native owner and detaches each replaced owner once', () => {
        const fixture = setup();
        fireEvent(screen.getByTestId('retained-layout', hidden), 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
        });
        expect(activeNativeAttachments('x')).toHaveLength(1);
        expect(activeNativeAttachments('y')).toHaveLength(1);
        const attachment = activeNativeAttachments('x')[0];
        const horizontal = screen
          .UNSAFE_getAllByType(ScrollView)
          .find(view => view.props.horizontal)!;
        expect(attachment.target).toBe(
          horizontal.instance.getNativeScrollRef(),
        );
        expect(attachment.eventName).toBe('onScroll');
        expect(attachment.mapping).toHaveLength(1);
        expect(
          attachment.mapping[0].nativeEvent.contentOffset.y,
        ).toBeUndefined();
        const vertical = activeNativeAttachments('y')[0];
        expect(vertical.target).not.toBe(attachment.target);
        const count = nativeAttachments.length;

        select(1);
        settleRoot(1);
        fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
        settleConditional();
        expect(nativeAttachments).toHaveLength(count);
        expect(attachment.detach).not.toHaveBeenCalled();

        fireEvent(screen.getByTestId('retained-layout', hidden), 'layout', {
          nativeEvent: {
            layout: { x: 0, y: 0, width: WIDTH + 100, height: 600 },
          },
        });
        expect(attachment.detach).toHaveBeenCalledTimes(1);
        expect(vertical.detach).not.toHaveBeenCalled();
        expect(activeNativeAttachments('x')).toHaveLength(1);
        const replacement = activeNativeAttachments('x')[0];
        expect(replacement.target).not.toBe(attachment.target);
        fixture.unmount();
        expect(attachment.detach).toHaveBeenCalledTimes(1);
        expect(replacement.detach).toHaveBeenCalledTimes(1);
        expect(vertical.detach).toHaveBeenCalledTimes(1);
        expect(activeNativeAttachments('x')).toHaveLength(0);
        expect(activeNativeAttachments('y')).toHaveLength(0);
      });

      it('keeps header X on its native clock when JS selection and worklet progress catch up', () => {
        setup();
        const attachment = activeNativeAttachments('x')[0];
        const nativeX = attachment.mapping[0].nativeEvent.contentOffset.x!;
        const setValue = jest.spyOn(nativeX, 'setValue');
        expect(groupHeaderX()).toBe(WIDTH);

        // Simulate only the external native Animated event mapping. Deliberately
        // withhold the JS/Reanimated scroll event to expose a second X writer.
        act(() => nativeX.setValue(WIDTH * 0.6));
        expect(groupHeaderX()).toBeCloseTo(WIDTH * 0.4);
        setValue.mockClear();
        select(1);
        settleRoot(1);
        expect(inspect().selected).toBe('Orders');
        expect(setValue).not.toHaveBeenCalled();
        expect(groupHeaderX()).toBeCloseTo(WIDTH * 0.4);

        act(() => nativeX.setValue(WIDTH * 1.5));
        expect(groupHeaderX()).toBe(0);
        setValue.mockClear();
        nativeScroll('onBeginDrag', 1);
        nativeScroll('onScroll', 0.75);
        expect(setValue).not.toHaveBeenCalled();
        expect(groupHeaderX()).toBe(0);

        act(() => nativeX.setValue(WIDTH * 2.25));
        expect(groupHeaderX()).toBeCloseTo(-WIDTH * 0.25);
        setValue.mockClear();
        nativeScroll('onEndDrag', 0.75);
        settleRoot(0);
        expect(inspect().selected).toBe('Positions');
        expect(setValue).not.toHaveBeenCalled();
        expect(groupHeaderX()).toBeCloseTo(-WIDTH * 0.25);
      });

      it.each(['before DOWN', 'between DOWN and START'] as const)(
        'does not steal a native tab command started %s',
        commandTiming => {
          setup();
          select(1);
          settleRoot(1);
          nativeScroll('onScroll', 1);
          const gesture = headerPan();
          if (commandTiming === 'before DOWN') {
            select(2);
          }
          const manager = headerTouchDown(gesture);
          if (commandTiming === 'before DOWN') {
            expect(manager.fail).toHaveBeenCalledTimes(1);
          } else {
            expect(manager.fail).not.toHaveBeenCalled();
            select(2);
          }

          // START must independently recheck readiness after a successful
          // DOWN, and rejected input must never cancel the existing command.
          act(() => gesture.handlers.onStart(headerPanEvent()));
          act(() => gesture.handlers.onUpdate(headerPanEvent(-WIDTH * 0.65)));
          act(() =>
            gesture.handlers.onEnd(headerPanEvent(-WIDTH * 0.65), true),
          );
          act(() =>
            gesture.handlers.onFinalize(headerPanEvent(-WIDTH * 0.65), false),
          );
          expect(mockNativeScrollTo).not.toHaveBeenCalled();
          expect(inspect()).toMatchObject({
            selected: 'Orders',
            pill: 'Basic',
          });
          nativeScroll('onScroll', 3);
          settleRoot(3);
          expect(inspect().selected).toBe('Account');
        },
      );

      it('rejects new header DOWN while its prior snap is pending and accepts the next idle gesture', () => {
        setup();
        select(1);
        settleRoot(1);
        nativeScroll('onScroll', 1);
        const gesture = headerPan();
        expect(headerTouchDown(gesture).fail).not.toHaveBeenCalled();
        act(() => gesture.handlers.onStart(headerPanEvent()));
        act(() => gesture.handlers.onUpdate(headerPanEvent(-WIDTH * 0.65)));
        nativeScroll('onScroll', 1.65);
        act(() => gesture.handlers.onEnd(headerPanEvent(-WIDTH * 0.65), true));
        const scrollCommands = mockNativeScrollTo.mock.calls.length;
        const nextGesture = headerPan();
        expect(nextGesture.config.enabled).toBe(true);
        expect(headerTouchDown(nextGesture).fail).toHaveBeenCalledTimes(1);
        act(() => nextGesture.handlers.onStart(headerPanEvent()));
        act(() => nextGesture.handlers.onUpdate(headerPanEvent(WIDTH * 0.4)));
        act(() => nextGesture.handlers.onFinalize(headerPanEvent(), false));
        expect(mockNativeScrollTo).toHaveBeenCalledTimes(scrollCommands);

        nativeScroll('onScroll', 2);
        expect(inspect().pill).toBe('Conditional');
        const idleGesture = headerPan();
        expect(headerTouchDown(idleGesture).fail).not.toHaveBeenCalled();
        act(() => idleGesture.handlers.onStart(headerPanEvent()));
        act(() => idleGesture.handlers.onUpdate(headerPanEvent(WIDTH * 0.65)));
        nativeScroll('onScroll', 1.35);
        act(() =>
          idleGesture.handlers.onEnd(headerPanEvent(WIDTH * 0.65), true),
        );
        nativeScroll('onScroll', 1);
        expect(inspect().pill).toBe('Basic');
      });

      it.each(['onMomentumEnd', 'onScroll'] as const)(
        'drives header drags through the existing horizontal owner and settles from native %s',
        completion => {
          setup();
          select(1);
          settleRoot(1);
          nativeScroll('onScroll', 1);
          const group = screen.getByTestId('retained-group-Orders', hidden);
          const gesture = headerPan();
          expect(gesture.config).toMatchObject({
            enabled: true,
            activeOffsetX: [-20, 20],
            failOffsetY: [-12, 12],
            maxPointers: 1,
          });
          const controls = screen.getByTestId('retained-pill-controls', hidden);
          expect(
            within(
              screen.getByTestId('native-header-pan-boundary', hidden),
            ).getByTestId('retained-pill-controls', hidden),
          ).toBe(controls);
          expect(
            within(
              screen.getByTestId('native-header-pan-boundary', hidden),
            ).queryByTestId('retained-rows-Orders-Basic', hidden),
          ).toBeNull();

          act(() => gesture.handlers.onStart(headerPanEvent()));
          expect(group.props.pointerEvents).toBe('none');
          expect(headerPan().config.enabled).toBe(true);
          act(() => gesture.handlers.onUpdate(headerPanEvent(-WIDTH * 0.65)));
          const nativeOwner = lastNativeScroll()?.[0];
          expect(nativeOwner?.current).toBeTruthy();
          expect(nativeOwner?.current).toBe(
            screen
              .UNSAFE_getAllByType(ScrollView)
              .find(view => view.props.horizontal)?.instance,
          );
          expect(mockNativeScrollTo).toHaveBeenLastCalledWith(
            nativeOwner,
            WIDTH * 1.65,
            0,
            false,
          );
          nativeScroll('onScroll', 1.65);
          act(() =>
            gesture.handlers.onEnd(headerPanEvent(-WIDTH * 0.65), true),
          );
          expect(mockNativeScrollTo).toHaveBeenLastCalledWith(
            nativeOwner,
            WIDTH * 2,
            0,
            true,
          );
          expect(inspect().pill).toBe('Basic');
          const scrollCommands = mockNativeScrollTo.mock.calls.length;
          act(() =>
            gesture.handlers.onFinalize(headerPanEvent(-WIDTH * 0.65), true),
          );
          expect(mockNativeScrollTo).toHaveBeenCalledTimes(scrollCommands);
          nativeScroll(completion, 2);
          expect(inspect()).toMatchObject({
            selected: 'Orders',
            pill: 'Conditional',
          });
          expect(group.props.pointerEvents).toBe('auto');
        },
      );

      it('ignores an unactivated header gesture and recovers a cancelled active drag', () => {
        setup();
        select(1);
        settleRoot(1);
        nativeScroll('onScroll', 1);
        const gesture = headerPan();
        // The native axis gate can fail before START (tap or vertical drag).
        // This simulates its callback contract, not recognizer arbitration.
        act(() => gesture.handlers.onFinalize(headerPanEvent(), false));
        expect(mockNativeScrollTo).not.toHaveBeenCalled();
        expect(inspect()).toMatchObject({ selected: 'Orders', pill: 'Basic' });

        act(() => gesture.handlers.onStart(headerPanEvent()));
        act(() => gesture.handlers.onUpdate(headerPanEvent(-WIDTH * 0.3)));
        nativeScroll('onScroll', 1.3);
        act(() =>
          gesture.handlers.onFinalize(headerPanEvent(-WIDTH * 0.3), false),
        );
        expect(lastNativeScroll()?.slice(1)).toEqual([WIDTH, 0, true]);
        nativeScroll('onMomentumEnd', 1);
        expect(inspect()).toMatchObject({ selected: 'Orders', pill: 'Basic' });
        fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
        settleConditional();
        expect(inspect().pill).toBe('Conditional');
      });

      it('corrects the native offset on cancellation even before the last drag scroll event arrives', () => {
        setup();
        select(1);
        settleRoot(1);
        nativeScroll('onScroll', 1);
        const gesture = headerPan();
        act(() => gesture.handlers.onStart(headerPanEvent()));
        act(() => gesture.handlers.onUpdate(headerPanEvent(-WIDTH * 0.3)));
        // The native command is dispatched, but its onScroll is still queued.
        // The earlier observed source offset cannot prove zero displacement.
        act(() =>
          gesture.handlers.onFinalize(headerPanEvent(-WIDTH * 0.3), false),
        );
        expect(lastNativeScroll()?.slice(1)).toEqual([WIDTH, 0, true]);
        expect(
          screen.getByTestId('retained-group-Orders', hidden).props
            .pointerEvents,
        ).toBe('none');
        nativeScroll('onScroll', 1.3);
        expect(inspect()).toMatchObject({ selected: 'Orders', pill: 'Basic' });
        nativeScroll('onScroll', 1);
        expect(
          screen.getByTestId('retained-group-Orders', hidden).props
            .pointerEvents,
        ).toBe('auto');
        fireEvent.press(screen.getByTestId('retained-pill-Conditional'));
        settleConditional();
        expect(inspect().pill).toBe('Conditional');
      });

      it('keeps the shared group header outside horizontal native content but inside the retained vertical owner', () => {
        setup();
        const outer = screen
          .UNSAFE_getAllByType(ScrollView)
          .find(view => !view.props.horizontal)!;
        const controls = screen.getByTestId('retained-pill-controls', hidden);
        const group = screen.getByTestId('retained-group-Orders', hidden);
        expect(
          within(track()).queryByTestId('retained-group-Orders', hidden),
        ).toBeNull();
        expect(within(outer).getByTestId('retained-group-Orders', hidden)).toBe(
          group,
        );
        expect(group.props.pointerEvents).toBe('none');

        select(1);
        settleRoot(1);
        expect(group.props.pointerEvents).toBe('auto');
        nativeScroll('onBeginDrag', 1);
        nativeScroll('onScroll', 1.5);
        expect(group.props.pointerEvents).toBe('none');
        nativeScroll('onEndDrag', 1.5);
        settleRoot(2);
        expect(group.props.pointerEvents).toBe('auto');
        select(2);
        settleRoot(3);
        expect(group.props.pointerEvents).toBe('none');
        select(1);
        settleRoot(2);

        expect(screen.getByTestId('retained-group-Orders', hidden)).toBe(group);
        expect(screen.getByTestId('retained-pill-controls', hidden)).toBe(
          controls,
        );
        expect(
          screen.getAllByTestId('retained-pill-controls', hidden),
        ).toHaveLength(1);
        expect(
          screen
            .UNSAFE_getAllByType(ScrollView)
            .find(view => !view.props.horizontal),
        ).toBe(outer);
      });

      it('cancels an in-flight horizontal command on viewport resize without replacing the vertical owner', () => {
        setup();
        const owner = screen
          .UNSAFE_getAllByType(ScrollView)
          .find(view => !view.props.horizontal);
        const layout = screen.getByTestId('retained-layout', hidden);
        fireEvent(layout, 'layout', {
          nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 600 } },
        });
        select(2);
        const oldTrack = track();
        fireEvent(layout, 'layout', {
          nativeEvent: {
            layout: { x: 0, y: 0, width: WIDTH + 100, height: 600 },
          },
        });
        expect(track()).not.toBe(oldTrack);
        expect(
          screen
            .UNSAFE_getAllByType(ScrollView)
            .find(view => !view.props.horizontal),
        ).toBe(owner);
        expect(inspect().selected).toBe('Positions');
        layoutTrack();
        select(1);
        settleRoot(1);
        expect(inspect().selected).toBe('Orders');
      });

      it('settles an already-observed aligned native target without waiting for a zero-distance animation', () => {
        const scrollTo = jest
          .spyOn(ScrollView.prototype, 'scrollTo')
          .mockImplementation(() => undefined);
        setup();
        // Native positioning can become observable before its JS selection
        // event; requesting that exact resting endpoint must not deadlock.
        nativeScroll('onScroll', 1);
        scrollTo.mockClear();
        select(1);
        expect(inspect().selected).toBe('Orders');
        expect(scrollTo).not.toHaveBeenCalled();
        select(2);
        settleRoot(accountIndex);
        expect(inspect().selected).toBe('Account');
      });

      it('bounds horizontal content height independently of retained long leaves', () => {
        setup();
        const measure = (key: string, height: number) =>
          fireEvent(
            screen.getByTestId(
              `retained-content-${JSON.stringify([key])}`,
              hidden,
            ),
            'layout',
            { nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height } } },
          );
        measure('Positions', 1800);
        measure('Account', 100);
        select(2);
        settleRoot(accountIndex);
        const height = StyleSheet.flatten(track().props.style).height;
        expect(height).toBeLessThan(1800);
        expect(
          StyleSheet.flatten(track().props.contentContainerStyle).height,
        ).toBe(height);
        for (const path of [
          ['Positions'],
          ['Orders', 'Basic'],
          ['Orders', 'Conditional'],
          ['Account'],
        ]) {
          expect(
            StyleSheet.flatten(
              screen.getByTestId(
                `retained-page-${JSON.stringify(path)}`,
                hidden,
              ).props.style,
            ).height,
          ).toBe(height);
        }
        select(0);
        settleRoot(0);
        expect(StyleSheet.flatten(track().props.style).height).toBe(1800);
      });

      it('ignores animator cancellation while a replacement finger drag owns the track', () => {
        jest.replaceProperty(Platform, 'OS', 'android');
        setup();
        select(2);
        nativeScroll('onScroll', 1.4);
        // Android begins the new drag before cancelling its old animator.
        nativeScroll('onBeginDrag', 1.4);
        nativeScroll('onMomentumEnd', 1.4);
        expect(inspect().selected).toBe('Positions');
        nativeScroll('onScroll', 1.6);
        nativeScroll('onEndDrag', 1.6);
        // Even after the finger lifts, an interrupted fractional endpoint is
        // not authoritative evidence for a logical page selection.
        nativeScroll('onMomentumEnd', 1.6);
        expect(inspect().selected).toBe('Positions');
        nativeScroll('onScroll', 2);
        nativeScroll('onMomentumEnd', 2);
        expect(inspect()).toMatchObject({
          selected: 'Orders',
          pill: 'Conditional',
        });
      });
    }

    it('cleans its Feed timer on unmount', () => {
      const intervals = jest.spyOn(global, 'setInterval');
      const clearInterval = jest.spyOn(global, 'clearInterval');
      const fixture = setup();
      fireEvent.press(screen.getByText('Feed'));
      tick();
      const feedCall = intervals.mock.calls.findIndex(
        ([, delay]) => delay === 100,
      );
      expect(feedCall).toBeGreaterThanOrEqual(0);
      const feedTimer = intervals.mock.results[feedCall].value;
      fixture.unmount();
      expect(clearInterval).toHaveBeenCalledWith(feedTimer);
    });
  },
);
