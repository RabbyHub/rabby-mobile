import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Animated as NativeAnimated, FlatList, View } from 'react-native';
import type { AnimatedRef } from 'react-native-reanimated';

type MockNativeRef = {
  (instance: unknown): void;
  current: unknown;
};

jest.mock('react-native-gesture-handler', () => ({
  Gesture: {},
}));

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof import('react');
  const ReactNative = require('react-native');
  const scrollHandler = jest.fn();
  return {
    __esModule: true,
    default: {
      // Match the installed Reanimated wrapper: a changed forwarded ref does
      // not replace the real inner callback or reattach the mounted instance.
      createAnimatedComponent: (
        Component: React.ComponentType<Record<string, unknown>>,
      ) =>
        ReactModule.forwardRef((props, forwardedRef) => {
          const currentForwardedRef = ReactModule.useRef(forwardedRef);
          currentForwardedRef.current = forwardedRef;
          const setInnerRef = ReactModule.useCallback((instance: unknown) => {
            const ref = currentForwardedRef.current;
            if (typeof ref === 'function') {
              ref(instance);
            } else if (ref) {
              ref.current = instance;
            }
          }, []);
          return ReactModule.createElement(Component, {
            ...props,
            ref: setInnerRef,
          });
        }),
      View: ReactNative.View,
    },
    scrollTo: jest.fn(),
    useAnimatedReaction: () => undefined,
    useAnimatedRef: () => {
      const stableRef = ReactModule.useRef<MockNativeRef | null>(null);
      if (!stableRef.current) {
        const ref = Object.assign(
          (instance: unknown) => {
            if (instance) {
              ref.current = instance;
            }
          },
          { current: null as unknown },
        );
        stableRef.current = ref;
      }
      return stableRef.current;
    },
    useAnimatedScrollHandler: () => scrollHandler,
    useSharedValue: <T,>(value: T) => ReactModule.useRef({ value }).current,
  };
});

import {
  CollapsibleSceneProvider,
  SceneList,
  type SceneListHandle,
} from '@rabby-wallet/rn-collapsible-scene-view';

type Row = { key: string };
const tabs = ['positions', 'openOrders', 'account'];
const rows = [{ key: 'row' }];
const renderRow = () => <View />;

const createNativeRef = () => {
  const callback = jest.fn((instance: FlatList<Row> | null) => {
    // Like Reanimated, an old ref can retain its tag on detach.
    if (instance) {
      callback.current = instance;
    }
  }) as jest.Mock & { current: FlatList<Row> | null };
  callback.current = null;
  return callback;
};

describe('SceneList native ref transfer', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rebinds new tab refs without remounting or scrolling the native list', () => {
    const positionsRef = createNativeRef();
    const openOrdersRef = createNativeRef();
    const accountRef = createNativeRef();
    const handle = React.createRef<SceneListHandle<Row>>();
    const renderList = (
      tab: string,
      nativeRef: ReturnType<typeof createNativeRef>,
    ) => (
      <CollapsibleSceneProvider
        activeTab={tab}
        headerHeight={0}
        syncOffsetOnActivate={false}
        tabs={tabs}>
        <SceneList
          contentInsetTop={0}
          data={rows}
          nativeRef={nativeRef as unknown as AnimatedRef<FlatList<Row>>}
          ref={handle}
          renderItem={renderRow}
          tabKey={tab}
        />
      </CollapsibleSceneProvider>
    );
    const view = render(renderList('positions', positionsRef));
    const mountedList = positionsRef.current!;
    const listElement = screen.UNSAFE_getByType(FlatList);
    const scrollToOffset = jest
      .spyOn(mountedList, 'scrollToOffset')
      .mockImplementation();

    expect(mountedList).toBeTruthy();
    view.rerender(renderList('openOrders', openOrdersRef));
    expect(openOrdersRef.current).toBe(mountedList);
    expect(positionsRef).toHaveBeenLastCalledWith(null);
    expect(screen.UNSAFE_getByType(FlatList)).toBe(listElement);
    expect(scrollToOffset).not.toHaveBeenCalled();
    act(() => handle.current?.scrollToOffset(240));
    expect(scrollToOffset).toHaveBeenLastCalledWith({
      animated: false,
      offset: 240,
    });

    view.rerender(renderList('account', accountRef));
    expect(accountRef.current).toBe(mountedList);
    expect(openOrdersRef).toHaveBeenLastCalledWith(null);
    view.rerender(renderList('positions', positionsRef));
    expect(positionsRef).toHaveBeenLastCalledWith(mountedList);
    expect(screen.UNSAFE_getByType(FlatList)).toBe(listElement);
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(positionsRef).toHaveBeenLastCalledWith(null);
  });

  it('binds the optional native clock to the scroll host, not logical tab refs', () => {
    const host = { nativeScrollHost: true };
    jest
      .spyOn(FlatList.prototype, 'getNativeScrollRef')
      .mockReturnValue(host as never);
    const attachments: { detach: jest.Mock }[] = [];
    const attachNativeEvent = jest
      .spyOn(
        NativeAnimated as typeof NativeAnimated & {
          attachNativeEvent: (
            target: unknown,
            name: string,
            mapping: unknown,
          ) => { detach: () => void };
        },
        'attachNativeEvent',
      )
      .mockImplementation(() => {
        const attachment = { detach: jest.fn() };
        attachments.push(attachment);
        return attachment;
      });
    const positionsRef = createNativeRef();
    const accountRef = createNativeRef();
    const firstClock = new NativeAnimated.Value(0);
    const nextClock = new NativeAnimated.Value(120);
    const renderList = (
      tab: string,
      nativeRef: ReturnType<typeof createNativeRef>,
      nativeScrollY?: NativeAnimated.Value,
      instanceKey = 'same-list',
    ) => (
      <CollapsibleSceneProvider
        activeTab={tab}
        headerHeight={0}
        syncOffsetOnActivate={false}
        tabs={tabs}>
        <SceneList
          contentInsetTop={0}
          data={rows}
          key={instanceKey}
          nativeRef={nativeRef as unknown as AnimatedRef<FlatList<Row>>}
          nativeScrollY={nativeScrollY}
          renderItem={renderRow}
          tabKey={tab}
        />
      </CollapsibleSceneProvider>
    );

    const view = render(renderList('positions', positionsRef, firstClock));
    const workletHandler = screen.UNSAFE_getByType(FlatList).props.onScroll;
    expect(typeof workletHandler).toBe('function');
    expect(attachNativeEvent).toHaveBeenCalledTimes(1);
    expect(attachNativeEvent).toHaveBeenLastCalledWith(host, 'onScroll', [
      { nativeEvent: { contentOffset: { y: firstClock } } },
    ]);
    expect(host).not.toBe(positionsRef.current);

    view.rerender(renderList('account', accountRef, firstClock));
    expect(accountRef.current).toBe(positionsRef.current);
    expect(attachNativeEvent).toHaveBeenCalledTimes(1);
    expect(attachments[0].detach).not.toHaveBeenCalled();
    expect(screen.UNSAFE_getByType(FlatList).props.onScroll).toBe(
      workletHandler,
    );

    view.rerender(renderList('account', accountRef, nextClock));
    expect(attachments[0].detach).toHaveBeenCalledTimes(1);
    expect(attachNativeEvent).toHaveBeenCalledTimes(2);
    expect(attachNativeEvent).toHaveBeenLastCalledWith(host, 'onScroll', [
      { nativeEvent: { contentOffset: { y: nextClock } } },
    ]);

    view.rerender(renderList('account', accountRef));
    expect(attachments[1].detach).toHaveBeenCalledTimes(1);
    expect(attachNativeEvent).toHaveBeenCalledTimes(2);

    view.rerender(renderList('account', accountRef, nextClock));
    expect(attachNativeEvent).toHaveBeenCalledTimes(3);
    view.rerender(renderList('account', accountRef, nextClock, 'new-list'));
    expect(attachments[2].detach).toHaveBeenCalledTimes(1);
    expect(attachNativeEvent).toHaveBeenCalledTimes(4);
    view.unmount();
    expect(attachments[3].detach).toHaveBeenCalledTimes(1);
  });
});
