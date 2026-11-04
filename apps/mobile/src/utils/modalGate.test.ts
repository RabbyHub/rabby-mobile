import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/core/utils/reexports', () => ({
  zCreate: jest.requireActual('zustand').create,
}));

import {
  acquireBlockingModal,
  dismissOpenNativeMenus,
  getVisibleBlockingModalIds,
  MODAL_GATE_IDS,
  resetModalGateForTests,
  useNativeMenuModalGate,
  useRegisterBlockingModal,
} from './modalGate';

const perpsEditorIds = [
  ['perpsProBasicOrderEdit', 'perps-pro-basic-order-edit'],
  ['perpsProConditionalOrderEdit', 'perps-pro-conditional-order-edit'],
  [
    'perpsProOpenOrderEditConfirmation',
    'perps-pro-open-order-edit-confirmation',
  ],
  ['perpsProPositionTpSlConfirmation', 'perps-pro-position-tpsl-confirmation'],
] as const;

describe('Perps Pro modal gate catalog', () => {
  beforeEach(resetModalGateForTests);
  afterEach(resetModalGateForTests);

  it.each(perpsEditorIds)(
    'registers and releases %s by its existing sheet ID',
    (key, id) => {
      expect(MODAL_GATE_IDS[key]).toBe(id);
      const hook = renderHook(
        ({ visible }) => useRegisterBlockingModal(id, visible),
        { initialProps: { visible: false } },
      );
      expect(getVisibleBlockingModalIds()).toEqual([]);
      hook.rerender({ visible: true });
      expect(getVisibleBlockingModalIds()).toEqual([id]);
      hook.rerender({ visible: false });
      expect(getVisibleBlockingModalIds()).toEqual([]);
      hook.rerender({ visible: true });
      hook.unmount();
      expect(getVisibleBlockingModalIds()).toEqual([]);
    },
  );

  it('keeps distinct editor and confirmation gates until each owner releases them', () => {
    const ids = perpsEditorIds.map(([key]) => MODAL_GATE_IDS[key]);
    const releases = ids.map(id => acquireBlockingModal(id));
    const releaseSecondBasicEditor = acquireBlockingModal(ids[0]);
    expect(getVisibleBlockingModalIds()).toEqual(ids);

    releases[0]();
    releases[0]();
    expect(getVisibleBlockingModalIds()).toEqual(ids);
    releaseSecondBasicEditor();
    expect(getVisibleBlockingModalIds()).toEqual(ids.slice(1));

    releases.slice(1).forEach(release => release());
    expect(getVisibleBlockingModalIds()).toEqual([]);
  });
});
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
