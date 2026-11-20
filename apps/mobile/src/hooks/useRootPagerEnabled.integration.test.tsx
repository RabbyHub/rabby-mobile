import { act, cleanup, renderHook } from '@testing-library/react-native';
import { AppState, Keyboard } from 'react-native';
import type { AppStateStatus, KeyboardEvent } from 'react-native';

import {
  acquireBlockingModal,
  MODAL_GATE_IDS,
  resetModalGateForTests,
} from '@/utils/modalGate';
import { useRootPagerEnabled } from './useRootPagerEnabled';

const appStateListeners = new Set<(state: AppStateStatus) => void>();
const keyboardListeners = new Map<
  string,
  Set<(event: KeyboardEvent) => void>
>();
const originalAppState = Object.getOwnPropertyDescriptor(
  AppState,
  'currentState',
);
const keyboardEvent: KeyboardEvent = {
  duration: 0,
  easing: 'keyboard',
  endCoordinates: { screenX: 0, screenY: 400, width: 400, height: 300 },
};
let keyboardVisible = false;

const setAppState = (state: AppStateStatus | null) => {
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    writable: true,
    value: state,
  });
};

const emitAppState = (state: AppStateStatus) => {
  setAppState(state);
  appStateListeners.forEach(listener => listener(state));
};

const emitKeyboard = (visible: boolean) => {
  keyboardVisible = visible;
  const eventName = visible ? 'keyboardDidShow' : 'keyboardDidHide';
  keyboardListeners
    .get(eventName)
    ?.forEach(listener => listener(keyboardEvent));
};

beforeEach(() => {
  resetModalGateForTests();
  setAppState('active');
  keyboardVisible = false;
  appStateListeners.clear();
  keyboardListeners.clear();

  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((type, listener) => {
      expect(type).toBe('change');
      appStateListeners.add(listener);
      return { remove: () => appStateListeners.delete(listener) };
    });
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => keyboardVisible);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
    const listeners = keyboardListeners.get(event) ?? new Set();
    keyboardListeners.set(event, listeners);
    listeners.add(listener);
    return { remove: () => listeners.delete(listener) };
  });
});

afterEach(() => {
  cleanup();
  resetModalGateForTests();
  jest.restoreAllMocks();
  if (originalAppState) {
    Object.defineProperty(AppState, 'currentState', originalAppState);
  }
});

describe('SwapBridge Root gesture eligibility', () => {
  it('requires screen focus without retaining a stale focus value', () => {
    const hook = renderHook(({ focused }) => useRootPagerEnabled(focused), {
      initialProps: { focused: true },
    });
    expect(hook.result.current).toBe(true);
    hook.rerender({ focused: false });
    expect(hook.result.current).toBe(false);
    hook.rerender({ focused: true });
    expect(hook.result.current).toBe(true);
  });

  it.each(['background', 'inactive', 'unknown', 'extension', null] as const)(
    'does not accept an initial %s app state as foreground',
    initialState => {
      setAppState(initialState);
      const hook = renderHook(() => useRootPagerEnabled(true));
      expect(hook.result.current).toBe(false);
      act(() => emitAppState('active'));
      expect(hook.result.current).toBe(true);
    },
  );

  it('observes foreground changes while keeping focus and modal requirements', () => {
    const hook = renderHook(({ focused }) => useRootPagerEnabled(focused), {
      initialProps: { focused: true },
    });
    act(() => emitAppState('inactive'));
    expect(hook.result.current).toBe(false);
    let release: () => void = () => undefined;
    act(() => {
      release = acquireBlockingModal(MODAL_GATE_IDS.swapModal);
      emitAppState('active');
    });
    expect(hook.result.current).toBe(false);
    hook.rerender({ focused: false });
    act(() => release());
    expect(hook.result.current).toBe(false);
    hook.rerender({ focused: true });
    expect(hook.result.current).toBe(true);
  });

  it('reads a blocking modal opened before this screen mounted', () => {
    const release = acquireBlockingModal(MODAL_GATE_IDS.nativeMenu);
    const hook = renderHook(() => useRootPagerEnabled(true));
    expect(hook.result.current).toBe(false);
    act(() => release());
    expect(hook.result.current).toBe(true);
  });

  it('keeps blocking until every registered owner releases its modal', () => {
    const hook = renderHook(() => useRootPagerEnabled(true));
    const releases: (() => void)[] = [];
    act(() => {
      releases.push(acquireBlockingModal(MODAL_GATE_IDS.swapModal));
      releases.push(acquireBlockingModal(MODAL_GATE_IDS.swapModal));
      releases.push(acquireBlockingModal(MODAL_GATE_IDS.biometricsStub));
    });
    expect(hook.result.current).toBe(false);
    act(() => releases[0]());
    expect(hook.result.current).toBe(false);
    act(() => releases[1]());
    expect(hook.result.current).toBe(false);
    act(() => releases[2]());
    expect(hook.result.current).toBe(true);
  });

  it('reads an already-visible keyboard before mounting and tracks later events', () => {
    keyboardVisible = true;
    const hook = renderHook(() => useRootPagerEnabled(true));
    expect(hook.result.current).toBe(false);
    act(() => emitKeyboard(false));
    expect(hook.result.current).toBe(true);
    act(() => emitKeyboard(true));
    expect(hook.result.current).toBe(false);
    act(() => emitKeyboard(false));
    expect(hook.result.current).toBe(true);
  });

  it('does not re-enable on keyboard dismissal while a modal or background remains', () => {
    const hook = renderHook(() => useRootPagerEnabled(true));
    const releases: (() => void)[] = [];
    act(() => {
      emitKeyboard(true);
      releases.push(acquireBlockingModal(MODAL_GATE_IDS.miniSignDirectOverlay));
    });
    act(() => emitKeyboard(false));
    expect(hook.result.current).toBe(false);
    act(() => {
      emitAppState('background');
      releases[0]();
    });
    expect(hook.result.current).toBe(false);
    act(() => emitAppState('active'));
    expect(hook.result.current).toBe(true);
  });

  it('removes its native subscriptions without affecting another mounted root', () => {
    const first = renderHook(() => useRootPagerEnabled(true));
    const second = renderHook(() => useRootPagerEnabled(true));
    expect(appStateListeners.size).toBe(2);
    expect(keyboardListeners.get('keyboardDidShow')?.size).toBe(2);
    expect(keyboardListeners.get('keyboardDidHide')?.size).toBe(2);

    first.unmount();
    expect(appStateListeners.size).toBe(1);
    expect(keyboardListeners.get('keyboardDidShow')?.size).toBe(1);
    act(() => emitKeyboard(true));
    expect(second.result.current).toBe(false);
    second.unmount();
    expect(appStateListeners.size).toBe(0);
    expect(keyboardListeners.get('keyboardDidShow')?.size).toBe(0);
    expect(keyboardListeners.get('keyboardDidHide')?.size).toBe(0);
  });
});
