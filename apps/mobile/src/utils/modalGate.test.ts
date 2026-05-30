import { act, renderHook } from '@testing-library/react-native';

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

import {
  MODAL_GATE_IDS,
  getModalGateDebugSnapshot,
  getVisibleBlockingModalIds,
  hasVisibleBlockingModal,
  subscribeModalGateDebugSnapshot,
  useRegisterBlockingModal,
  useVisibleBlockingModalIds,
} from './modalGate';

describe('modalGate utils', () => {
  it('starts with no visible blocking modal and exposes debug dump helpers in dev', () => {
    expect(getVisibleBlockingModalIds()).toEqual([]);
    expect(hasVisibleBlockingModal()).toBe(false);
    expect(getModalGateDebugSnapshot()).toEqual({
      visibleBlockingModalCount: 0,
      visibleBlockingModalIds: [],
    });
    expect((globalThis as any).__dumpBlockingModalIds()).toEqual([]);
    expect((globalThis as any).__dumpModalGateDebugSnapshot()).toEqual({
      visibleBlockingModalCount: 0,
      visibleBlockingModalIds: [],
    });
  });

  it('registers a visible blocking modal and unregisters it on unmount', () => {
    const { unmount } = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.rateGuide, true),
    );

    expect(getVisibleBlockingModalIds()).toEqual([MODAL_GATE_IDS.rateGuide]);
    expect(hasVisibleBlockingModal()).toBe(true);
    expect(
      hasVisibleBlockingModal({ excludeIds: [MODAL_GATE_IDS.rateGuide] }),
    ).toBe(false);

    unmount();

    expect(getVisibleBlockingModalIds()).toEqual([]);
    expect(hasVisibleBlockingModal()).toBe(false);
  });

  it('does not register invisible modals and cleans up when visibility changes', () => {
    const { rerender, unmount } = renderHook(
      ({ visible }) =>
        useRegisterBlockingModal(MODAL_GATE_IDS.screenshotFeedback, visible),
      {
        initialProps: { visible: false },
      },
    );

    expect(getVisibleBlockingModalIds()).toEqual([]);

    rerender({ visible: true });
    expect(getVisibleBlockingModalIds()).toEqual([
      MODAL_GATE_IDS.screenshotFeedback,
    ]);

    rerender({ visible: false });
    expect(getVisibleBlockingModalIds()).toEqual([]);

    unmount();
  });

  it('keeps a modal id visible until all duplicate registrations unmount', () => {
    const first = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.swapModal, true),
    );
    const second = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.swapModal, true),
    );

    expect(getVisibleBlockingModalIds()).toEqual([MODAL_GATE_IDS.swapModal]);

    first.unmount();
    expect(getVisibleBlockingModalIds()).toEqual([MODAL_GATE_IDS.swapModal]);

    second.unmount();
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });

  it('returns sorted ids from the visible ids hook', () => {
    const first = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.swapModal, true),
    );
    const second = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.rateGuide, true),
    );
    const { result, unmount } = renderHook(() => useVisibleBlockingModalIds());

    expect(result.current).toEqual([
      MODAL_GATE_IDS.rateGuide,
      MODAL_GATE_IDS.swapModal,
    ]);

    first.unmount();
    second.unmount();
    unmount();
  });

  it('emits debug snapshots only when visible modal id set changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeModalGateDebugSnapshot(listener);

    expect(listener).toHaveBeenCalledWith({
      visibleBlockingModalCount: 0,
      visibleBlockingModalIds: [],
    });

    const first = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.securityTip, true),
    );
    const second = renderHook(() =>
      useRegisterBlockingModal(MODAL_GATE_IDS.securityTip, true),
    );

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith({
      visibleBlockingModalCount: 1,
      visibleBlockingModalIds: [MODAL_GATE_IDS.securityTip],
    });

    first.unmount();
    expect(listener).toHaveBeenCalledTimes(2);

    second.unmount();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener).toHaveBeenLastCalledWith({
      visibleBlockingModalCount: 0,
      visibleBlockingModalIds: [],
    });

    act(() => {
      unsubscribe();
    });
  });
});
