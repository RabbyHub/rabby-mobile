import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

import {
  acquireBlockingModal,
  dismissOpenNativeMenus,
  getVisibleBlockingModalIds,
  MODAL_GATE_IDS,
  useNativeMenuModalGate,
} from './modalGate';

const NATIVE_MENU = MODAL_GATE_IDS.nativeMenu;

function renderMenuGate() {
  const dismissMenu = jest.fn(() => Promise.resolve());
  const hook = renderHook(() => useNativeMenuModalGate());
  hook.result.current.iosMenuViewRef.current = { dismissMenu };

  return { ...hook, dismissMenu };
}

describe('acquireBlockingModal', () => {
  it('releases only once even when called repeatedly', () => {
    const releaseA = acquireBlockingModal(NATIVE_MENU);
    const releaseB = acquireBlockingModal(NATIVE_MENU);

    releaseA();
    releaseA();
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    releaseB();
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });
});

describe('useNativeMenuModalGate', () => {
  afterEach(() => {
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });

  it('blocks from will-open until the menu has fully hidden', () => {
    const { result, unmount } = renderHook(() => useNativeMenuModalGate());

    act(() => result.current.onOpenWillChange(true));
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    act(() => result.current.onOpenChange(true));
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    // The menu view controller is still presented while it animates out.
    act(() => result.current.onOpenWillChange(false));
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    act(() => result.current.onOpenChange(false));
    expect(getVisibleBlockingModalIds()).toEqual([]);

    unmount();
  });

  it('releases when the menu unmounts while open', () => {
    const { result, unmount } = renderHook(() => useNativeMenuModalGate());

    act(() => result.current.onOpenWillChange(true));
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    unmount();
  });

  it('keeps other open menus blocking when one closes', () => {
    const first = renderHook(() => useNativeMenuModalGate());
    const second = renderHook(() => useNativeMenuModalGate());

    act(() => first.result.current.onOpenWillChange(true));
    act(() => second.result.current.onOpenWillChange(true));

    act(() => first.result.current.onOpenChange(false));
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    act(() => second.result.current.onOpenChange(false));
    expect(getVisibleBlockingModalIds()).toEqual([]);

    first.unmount();
    second.unmount();
  });
});

describe('dismissOpenNativeMenus', () => {
  afterEach(() => {
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });

  it('dismisses only open menus and keeps blocking until did-hide', () => {
    const open = renderMenuGate();
    const closed = renderMenuGate();

    act(() => open.result.current.onOpenWillChange(true));

    dismissOpenNativeMenus();
    expect(open.dismissMenu).toHaveBeenCalledTimes(1);
    expect(closed.dismissMenu).not.toHaveBeenCalled();
    expect(getVisibleBlockingModalIds()).toEqual([NATIVE_MENU]);

    act(() => open.result.current.onOpenChange(false));
    dismissOpenNativeMenus();
    expect(open.dismissMenu).toHaveBeenCalledTimes(1);

    open.unmount();
    closed.unmount();
  });

  it('forgets menus that unmount while open', () => {
    const menu = renderMenuGate();

    act(() => menu.result.current.onOpenWillChange(true));
    menu.unmount();

    dismissOpenNativeMenus();
    expect(menu.dismissMenu).not.toHaveBeenCalled();
  });
});
