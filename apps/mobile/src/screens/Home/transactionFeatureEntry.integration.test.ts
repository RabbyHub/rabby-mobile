import { createStore } from 'zustand/vanilla';

import type { SwapBridgeTab } from '@/navigation-type';
import type { KeyringAccountWithAlias } from '@/types/account';
import {
  claimSendScreenSession,
  getSendScreenActivationPlan,
  isSendScreenSessionActive,
  releaseSendScreenSession,
  resetSendScreenSessionForTests,
} from '@/screens/Send/sendScreenSession';
import {
  createInitialMountedSwapBridgeScenes,
  mountSwapBridgeScene,
} from '@/screens/SwapBridge/sceneMounting';
import { isSwapBridgeSceneActive } from '@/screens/SwapBridge/sceneActivation';
import { enterSingleAddressTransactionFeature } from './transactionFeatureEntry';

type NavigationEntry =
  | { key: 'home'; screen: 'Home' }
  | { key: string; screen: 'Send' }
  | { key: string; screen: 'SwapBridge'; activeTab: SwapBridgeTab };

type SendLifecycleState = {
  inited: boolean;
  initializationCount: number;
};

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

function createDeferred(): Deferred {
  let resolve = () => undefined;
  const promise = new Promise<void>(release => {
    resolve = release;
  });
  return { promise, resolve };
}

function createNavigationHarness() {
  let nextRouteId = 0;
  const stack: NavigationEntry[] = [{ key: 'home', screen: 'Home' }];

  return {
    pushSend() {
      stack.push({ key: `send-${++nextRouteId}`, screen: 'Send' });
    },
    pushSwapBridge(activeTab: SwapBridgeTab) {
      stack.push({
        key: `swap-bridge-${++nextRouteId}`,
        screen: 'SwapBridge',
        activeTab,
      });
    },
    pop() {
      if (stack.length > 1) {
        stack.pop();
      }
    },
    getCurrent: () => stack[stack.length - 1],
    getStack: () => [...stack],
  };
}

function activateSendRoute(
  routeKey: string,
  store: ReturnType<typeof createStore<SendLifecycleState>>,
  hadClaimedSession: boolean,
) {
  const { ownerChanged, session } = claimSendScreenSession(routeKey);
  const plan = getSendScreenActivationPlan({
    hadClaimedSession,
    ownerChanged,
    screenStateInited: store.getState().inited,
  });

  if (plan.resetSharedState) {
    store.setState({ inited: false });
  }
  if (plan.restartInitialization) {
    store.setState(state => ({
      inited: true,
      initializationCount: state.initializationCount + 1,
    }));
  }

  return { plan, session };
}

describe('Home transaction feature lifecycle integration', () => {
  let consoleInfoSpy: jest.SpyInstance;

  const account = {
    address: '0x1111111111111111111111111111111111111111',
    aliasName: 'Integration Account',
    type: 'Simple Key Pair',
    brandName: 'Simple Key Pair',
  } as KeyringAccountWithAlias;

  beforeEach(() => {
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    resetSendScreenSessionForTests();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  it('waits for scene account context, initializes Send once, and restores its stack state', async () => {
    const sceneGate = createDeferred();
    const navigation = createNavigationHarness();
    const sendStore = createStore<SendLifecycleState>(() => ({
      inited: false,
      initializationCount: 0,
    }));
    let sceneAccount: KeyringAccountWithAlias | null = null;

    const entryPromise = enterSingleAddressTransactionFeature('send', account, {
      switchSceneCurrentAccount: async nextAccount => {
        await sceneGate.promise;
        sceneAccount = nextAccount;
      },
      navigateToSend: () => navigation.pushSend(),
      navigateToSwapBridge: tab => navigation.pushSwapBridge(tab),
    });

    expect(navigation.getCurrent()).toEqual({ key: 'home', screen: 'Home' });

    sceneGate.resolve();
    await expect(entryPromise).resolves.toBe(true);
    expect(sceneAccount).toBe(account);

    const sendRoute = navigation.getCurrent();
    expect(sendRoute.screen).toBe('Send');
    const firstActivation = activateSendRoute(sendRoute.key, sendStore, false);
    expect(firstActivation.plan).toEqual({
      resetSharedState: false,
      restartInitialization: true,
    });
    expect(sendStore.getState()).toEqual({
      inited: true,
      initializationCount: 1,
    });

    navigation.pushSwapBridge('swap');
    navigation.pop();
    expect(navigation.getCurrent()).toEqual(sendRoute);

    const restoredActivation = activateSendRoute(
      sendRoute.key,
      sendStore,
      true,
    );
    expect(restoredActivation.plan).toEqual({
      resetSharedState: false,
      restartInitialization: false,
    });
    expect(sendStore.getState().initializationCount).toBe(1);
    expect(isSendScreenSessionActive(restoredActivation.session)).toBe(true);

    navigation.pop();
    expect(navigation.getCurrent()).toEqual({ key: 'home', screen: 'Home' });
    expect(releaseSendScreenSession(restoredActivation.session)).toBe(true);
  });

  it.each(['swap', 'bridge'] as const)(
    'enters %s with only its scene mounted and restores the selected tab after refocus',
    async initialTab => {
      const navigation = createNavigationHarness();
      let sceneAccount: KeyringAccountWithAlias | null = null;

      await enterSingleAddressTransactionFeature(initialTab, account, {
        switchSceneCurrentAccount: async nextAccount => {
          sceneAccount = nextAccount;
        },
        navigateToSend: () => navigation.pushSend(),
        navigateToSwapBridge: tab => navigation.pushSwapBridge(tab),
      });

      expect(sceneAccount).toBe(account);
      expect(navigation.getCurrent()).toEqual(
        expect.objectContaining({
          screen: 'SwapBridge',
          activeTab: initialTab,
        }),
      );

      let activeTab = initialTab;
      let mountedScenes = createInitialMountedSwapBridgeScenes(activeTab);
      expect(mountedScenes).toEqual({
        swap: initialTab === 'swap',
        bridge: initialTab === 'bridge',
      });

      const otherTab: SwapBridgeTab = initialTab === 'swap' ? 'bridge' : 'swap';
      mountedScenes = mountSwapBridgeScene(mountedScenes, otherTab);
      activeTab = otherTab;

      expect(mountedScenes).toEqual({ swap: true, bridge: true });
      expect(
        isSwapBridgeSceneActive({
          activeTab,
          scene: activeTab,
          screenFocused: false,
        }),
      ).toBe(false);
      expect(
        isSwapBridgeSceneActive({
          activeTab,
          scene: activeTab,
          screenFocused: true,
        }),
      ).toBe(true);

      navigation.pop();
      expect(navigation.getCurrent()).toEqual({ key: 'home', screen: 'Home' });
    },
  );

  it('does not mutate scene state or navigation without an account', async () => {
    const navigation = createNavigationHarness();
    let switchCount = 0;

    await expect(
      enterSingleAddressTransactionFeature('swap', null, {
        switchSceneCurrentAccount: async () => {
          switchCount += 1;
        },
        navigateToSend: () => navigation.pushSend(),
        navigateToSwapBridge: tab => navigation.pushSwapBridge(tab),
      }),
    ).resolves.toBe(false);

    expect(switchCount).toBe(0);
    expect(navigation.getStack()).toEqual([{ key: 'home', screen: 'Home' }]);
  });
});
