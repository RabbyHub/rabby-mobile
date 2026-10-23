import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { FlatList, Platform, StyleSheet } from 'react-native';

const mockSetPage = jest.fn();

// Keep the real fixture, retained pager, SceneList/provider and activity scopes.
// Native presentation callbacks are not a simulation of UIKit/layout.
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
  const native = require('react-native');
  return {
    Pressable: native.Pressable,
    Text: native.Text,
    TextInput: native.TextInput,
  };
});
jest.mock('react-native-animateable-text', () => require('react-native').Text);
// Typography also exports this unused external presentation primitive.
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
    useAnimatedScrollHandler:
      (handlers: { onScroll: (event: unknown) => void }) =>
      (event: { nativeEvent: unknown }) =>
        handlers.onScroll(event.nativeEvent),
    useEvent: (handler: unknown) => handler,
    runOnUI: (callback: unknown) => callback,
    runOnJS: (callback: unknown) => callback,
    scrollTo: jest.fn(),
  };
});

import DevUIRetainedTabs from './DevUIRetainedTabs';

const keys = ['Positions', 'Orders', 'Account'];
const hidden = { includeHiddenElements: true };
const pager = () => screen.getByTestId('retained-pager', hidden);
const list = (index: number) =>
  screen.getByTestId(`retained-rows-${keys[index]}`, hidden);
const select = (index: number) =>
  fireEvent.press(screen.getByTestId(`retained-tab-${index}`));
const selected = (position: number) =>
  fireEvent(pager(), 'pageSelected', { position });
const pageState = (pageScrollState: 'dragging' | 'idle') =>
  fireEvent(pager(), 'pageScrollStateChanged', { pageScrollState });
const pageScroll = (position: number, offset: number) =>
  fireEvent(pager(), 'pageScroll', { position, offset });
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

describe('DevUIRetainedTabs shared-component fixture', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.replaceProperty(Platform, 'OS', 'ios');
    mockSetPage.mockClear();
  });
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('iOS tab clicks finish on selected without a synthetic idle event', () => {
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    select(2);
    expect(mockSetPage.mock.calls).toEqual([[2]]);
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Positions',
    );
    selected(2);
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Account',
    );
    select(2);
    expect(mockSetPage).toHaveBeenCalledTimes(1);
  });

  it('Android waits for idle after selected before committing the fixture tab', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    select(1);
    selected(1);
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Positions',
    );
    pageState('idle');
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Orders',
    );
  });

  it('retains three shared lists and leaves header/trade outside horizontal motion', () => {
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    const lists = keys.map((_, index) => list(index));
    const header = screen.getByTestId('retained-header');
    expect(screen.UNSAFE_getAllByType(FlatList)).toHaveLength(4);
    expect(within(pager()).queryByTestId('retained-header', hidden)).toBeNull();
    for (const index of [1, 2, 0]) {
      select(index);
      selected(index);
    }
    keys.forEach((_, index) => expect(list(index)).toBe(lists[index]));
    expect(screen.getByTestId('retained-header')).toBe(header);
    fireEvent.press(screen.getByTestId('retained-trade'));
    expect(screen.getByText('Trade button: 1')).toBeTruthy();
  });

  it('uses native-measured rows and keeps long/short/append fixture controls', () => {
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    expect(screen.queryByTestId('retained-geometry')).toBeNull();
    keys.forEach((_, index) =>
      expect(
        StyleSheet.flatten(list(index).props.style).height,
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
    expect(Object.keys(next.pages[0]).sort()).toEqual([
      'fixtureRows',
      'key',
      'rowMounts',
      'rowRenders',
      'rowUnmounts',
    ]);
    select(2);
    selected(2);
    expect(screen.queryByTestId('retained-row-2-5', hidden)).toBeNull();
    expect(screen.getByTestId('retained-row-2-4', hidden)).toBeTruthy();
  });

  it('Feed catches up the revealed neighbour and cancellation re-pauses it without selection', () => {
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    fireEvent.press(screen.getByText('Feed'));
    tick();
    expectRevision(0, 1);
    expectRevision(1, 0);
    expectRevision(2, 0);
    pageState('dragging');
    pageScroll(0, 0.4);
    expectRevision(1, 1);
    tick();
    expectRevision(1, 2);
    pageScroll(0, 0);
    pageState('idle');
    tick();
    expectRevision(0, 3);
    expectRevision(1, 2);
    expectRevision(2, 0);
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Positions',
    );
    fireEvent.press(screen.getByText('Stop'));
    tick();
    expect(inspect().source).toBe(3);
  });

  it('routes Deep/Top through the public scroll handle without tab-scroll replay', () => {
    const scrollToOffset = jest
      .spyOn(FlatList.prototype, 'scrollToOffset')
      .mockImplementation(() => undefined);
    const onBack = jest.fn();
    render(<DevUIRetainedTabs onBack={onBack} />);
    expect(scrollToOffset).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Deep'));
    fireEvent.press(screen.getByText('Top'));
    expect(scrollToOffset.mock.calls).toEqual([
      [{ offset: 4000, animated: false }],
      [{ offset: 0, animated: false }],
    ]);
    select(1);
    selected(1);
    expect(scrollToOffset).toHaveBeenCalledTimes(2);
    fireEvent.press(screen.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('serializes rapid fixture tab requests through the shared component', () => {
    render(<DevUIRetainedTabs onBack={jest.fn()} />);
    select(1);
    select(0);
    select(2);
    expect(mockSetPage.mock.calls).toEqual([[1]]);
    selected(1);
    expect(mockSetPage.mock.calls).toEqual([[1], [2]]);
    selected(2);
    expect(screen.getByTestId('retained-selection')).toHaveTextContent(
      'Retained native tabs: Account',
    );
  });

  it('cleans the fixture Feed timer on unmount', () => {
    const intervals = jest.spyOn(global, 'setInterval');
    const clearInterval = jest.spyOn(global, 'clearInterval');
    const fixture = render(<DevUIRetainedTabs onBack={jest.fn()} />);
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
});
