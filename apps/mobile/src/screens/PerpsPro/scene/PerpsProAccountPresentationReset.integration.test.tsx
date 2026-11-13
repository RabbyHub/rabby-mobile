import React, { useRef } from 'react';
import { act, cleanupAsync, render } from '@testing-library/react-native';
import { useAnimatedValue } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  CollapsibleSceneProvider,
  useCollapsibleScene,
  useCollapsibleSceneController,
  type CollapsibleSceneContextValue,
  type CollapsibleSceneController,
} from '@rabby-wallet/rn-collapsible-scene-view';

import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { PERPS_PRO_INFO_TABS } from '../components/info/perpsProInfoTabOrder';
import {
  PERPS_PRO_INFO_TOUCH_INTENT,
  usePerpsProInfoScrollBridge,
} from '../components/info/usePerpsProInfoScrollBridge';
import { PerpsProAccountPresentationReset } from './PerpsProAccountPresentationReset';

const mockNativeScrollTo = jest.fn();

// JS integration: real provider/controller/bridge/reset ownership. Only the
// native/UI worklet boundary is synchronous; no native onScroll is emitted.
jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react') as typeof import('react');
  return {
    __esModule: true,
    default: {
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    cancelAnimation: jest.fn(),
    runOnUI: (callback: (...args: unknown[]) => unknown) => callback,
    scrollTo: (...args: unknown[]) => mockNativeScrollTo(...args),
    useSharedValue: <T,>(value: T) => ReactModule.useRef({ value }).current,
    useAnimatedRef: () =>
      ReactModule.useMemo(() => {
        const ref = (instance: unknown) => {
          ref.current = instance;
        };
        ref.current = null as unknown;
        return ref;
      }, []),
    useScrollViewOffset: (_ref: unknown, offset: unknown) => offset,
    useAnimatedReaction: <T,>(
      prepare: () => T,
      react: (value: T, previous: T | null) => void,
      dependencies: unknown[] = [],
    ) => {
      const previous = ReactModule.useRef<T | null>(null);
      const value = prepare();
      ReactModule.useLayoutEffect(() => {
        react(value, previous.current);
        previous.current = value;
        // This boundary represents the controlled reaction, not UI scheduling.
      }, [value, ...dependencies]);
    },
  };
});

type Presentation = {
  bridge: ReturnType<typeof usePerpsProInfoScrollBridge>;
  controller: CollapsibleSceneController;
  indicatorPosition: ReturnType<typeof useSharedValue<number>>;
  listContentHeight: React.RefObject<number>;
  nativeScrollY: ReturnType<typeof useAnimatedValue>;
};
type Snapshot = Presentation & { scene: CollapsibleSceneContextValue };

function Probe({
  presentation,
  observe,
}: {
  presentation: Presentation;
  observe: (snapshot: Snapshot) => void;
}) {
  observe({ ...presentation, scene: useCollapsibleScene() });
  return null;
}

function Harness({
  accountIdentity,
  activeTab,
  observe,
}: {
  accountIdentity: string;
  activeTab: PerpsProInfoTab | null;
  observe: (snapshot: Snapshot) => void;
}) {
  const controller = useCollapsibleSceneController();
  const nativeScrollY = useAnimatedValue(0);
  const bridge = usePerpsProInfoScrollBridge(activeTab ?? 'positions');
  const indicatorPosition = useSharedValue(
    PERPS_PRO_INFO_TABS.indexOf(activeTab ?? 'positions'),
  );
  const listContentHeight = useRef(0);
  const presentation = {
    bridge,
    controller,
    indicatorPosition,
    listContentHeight,
    nativeScrollY,
  };

  return (
    <CollapsibleSceneProvider
      activeTab={activeTab ?? 'positions'}
      controller={controller}
      headerHeight={100}
      syncOffsetOnActivate={false}
      tabs={PERPS_PRO_INFO_TABS}>
      <PerpsProAccountPresentationReset
        accountIdentity={accountIdentity}
        activeTab={activeTab}
        {...presentation}
      />
      <Probe presentation={presentation} observe={observe} />
    </CollapsibleSceneProvider>
  );
}

function seedPreviousAccount(snapshot: Snapshot) {
  snapshot.nativeScrollY.setValue(450);
  snapshot.listContentHeight.current = 1800;
  PERPS_PRO_INFO_TABS.forEach((tab, index) => {
    snapshot.scene.reportScroll(tab, 450 + index);
    snapshot.bridge.targets[index].offset.value = 450 + index;
    snapshot.bridge.targets[index].maxOffset.value = 1000 + index;
  });
  snapshot.indicatorPosition.value = 0.6;
  snapshot.bridge.epoch.value = 7;
  snapshot.bridge.touchSessionId.value = 9;
  snapshot.bridge.horizontalTouchSessionId.value = 9;
  snapshot.bridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.horizontal;
  snapshot.bridge.pageGestureActive.value = true;
}

describe('Perps Pro account presentation reset', () => {
  afterEach(async () => {
    await cleanupAsync();
    jest.restoreAllMocks();
    mockNativeScrollTo.mockClear();
  });

  it('resets both providers and bridge without waiting for a native scroll or issuing a scroll command', () => {
    let snapshot!: Snapshot;
    const observe = (next: Snapshot) => {
      snapshot = next;
    };
    const view = render(
      <Harness
        accountIdentity="account-a"
        activeTab="positions"
        observe={observe}
      />,
    );
    const firstController = snapshot.controller;
    const firstBridge = snapshot.bridge;
    const scrollCommand = jest.fn();
    const unregister = snapshot.controller.registerTabScroll('positions', {
      scrollTo: scrollCommand,
    });
    act(() => seedPreviousAccount(snapshot));
    const nativeSetValue = jest.spyOn(snapshot.nativeScrollY, 'setValue');

    view.rerender(
      <Harness
        accountIdentity="account-b"
        activeTab="account"
        observe={observe}
      />,
    );

    expect(snapshot.controller).toBe(firstController);
    expect(snapshot.bridge).toBe(firstBridge);
    expect(nativeSetValue).toHaveBeenCalledTimes(1);
    expect(nativeSetValue).toHaveBeenCalledWith(0);
    expect(snapshot.nativeScrollY.__getValue()).toBe(0);
    expect(snapshot.listContentHeight.current).toBe(0);
    expect(snapshot.controller.scrollY.value).toBe(0);
    expect(snapshot.scene.scrollY).toBe(snapshot.controller.scrollY);
    expect(snapshot.scene.activeTabIndex.value).toBe(2);
    expect(PERPS_PRO_INFO_TABS.map(snapshot.scene.getSavedOffset)).toEqual([
      0, 0, 0,
    ]);
    expect(snapshot.bridge.activeIndex.value).toBe(2);
    expect(snapshot.bridge.targets.map(target => target.offset.value)).toEqual([
      0, 0, 0,
    ]);
    expect(
      snapshot.bridge.targets.map(target => target.maxOffset.value),
    ).toEqual([0, 0, 0]);
    expect(snapshot.bridge.epoch.value).toBe(8);
    expect(snapshot.bridge.touchSessionId.value).toBe(10);
    expect(snapshot.bridge.horizontalTouchSessionId.value).toBe(0);
    expect(snapshot.bridge.touchIntent.value).toBe(
      PERPS_PRO_INFO_TOUCH_INTENT.idle,
    );
    expect(snapshot.bridge.pageGestureActive.value).toBe(false);
    expect(snapshot.indicatorPosition.value).toBe(2);
    expect(scrollCommand).not.toHaveBeenCalled();
    expect(mockNativeScrollTo).not.toHaveBeenCalled();
    unregister();
  });

  it('does not reset the same account on rerenders or ordinary tab changes', () => {
    let snapshot!: Snapshot;
    const observe = (next: Snapshot) => {
      snapshot = next;
    };
    const tree = (activeTab: PerpsProInfoTab) => (
      <Harness
        accountIdentity="account-a"
        activeTab={activeTab}
        observe={observe}
      />
    );
    const view = render(tree('positions'));
    act(() => seedPreviousAccount(snapshot));
    const nativeSetValue = jest.spyOn(snapshot.nativeScrollY, 'setValue');

    view.rerender(tree('positions'));
    view.rerender(tree('openOrders'));

    expect(nativeSetValue).not.toHaveBeenCalled();
    expect(snapshot.nativeScrollY.__getValue()).toBe(450);
    expect(snapshot.listContentHeight.current).toBe(1800);
    expect(snapshot.controller.scrollY.value).toBe(450);
    expect(PERPS_PRO_INFO_TABS.map(snapshot.scene.getSavedOffset)).toEqual([
      450, 451, 452,
    ]);
    expect(
      snapshot.bridge.targets.map(target => target.maxOffset.value),
    ).toEqual([1000, 1001, 1002]);
    expect(snapshot.bridge.targets.map(target => target.offset.value)).toEqual([
      450, 450, 452,
    ]);
    expect(snapshot.bridge.epoch.value).toBe(7);
    expect(snapshot.bridge.touchSessionId.value).toBe(9);
    expect(snapshot.bridge.pageGestureActive.value).toBe(true);
    expect(snapshot.indicatorPosition.value).toBe(0.6);
    expect(mockNativeScrollTo).not.toHaveBeenCalled();
  });

  it('resets once when the account changes before its initial tab becomes ready', () => {
    let snapshot!: Snapshot;
    const observe = (next: Snapshot) => {
      snapshot = next;
    };
    const view = render(
      <Harness
        accountIdentity="account-a"
        activeTab="account"
        observe={observe}
      />,
    );
    act(() => seedPreviousAccount(snapshot));
    const nativeSetValue = jest.spyOn(snapshot.nativeScrollY, 'setValue');

    view.rerender(
      <Harness
        accountIdentity="no-account"
        activeTab={null}
        observe={observe}
      />,
    );
    expect(snapshot.controller.scrollY.value).toBe(0);
    expect(snapshot.bridge.activeIndex.value).toBe(0);
    expect(snapshot.indicatorPosition.value).toBe(0);

    view.rerender(
      <Harness
        accountIdentity="no-account"
        activeTab="openOrders"
        observe={observe}
      />,
    );
    expect(nativeSetValue).toHaveBeenCalledTimes(1);
    expect(snapshot.bridge.epoch.value).toBe(8);
    expect(snapshot.bridge.activeIndex.value).toBe(1);
    expect(mockNativeScrollTo).not.toHaveBeenCalled();
  });
});
