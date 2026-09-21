import { act, renderHook } from '@testing-library/react-native';
import type { BottomSheetScrollViewMethods } from '@gorhom/bottom-sheet';
import { Keyboard, StatusBar, UIManager } from 'react-native';
import {
  perpsProKeyboardSession,
  type PerpsProKeyboardInput,
} from './perpsProKeyboardSession';
import { usePerpsProSheetKeyboard } from './usePerpsProSheetKeyboard';

let mockAndroid = true;
jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  __esModule: true,
  default: {
    measureInWindow: jest.fn(),
    measureLayout: jest.fn(),
  },
}));
jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockAndroid;
  },
}));

type Measure = (x: number, y: number, width: number, height: number) => void;
const listeners = new Map<string, (...args: any[]) => void>();
const frames = new Map<number, FrameRequestCallback>();
let nextFrame = 0;
let measureViewport: Measure;
let measureInput: Measure;
let measureContent: Measure;
const input: PerpsProKeyboardInput = {
  blur: jest.fn(),
  isFocused: jest.fn(() => true),
  measureInWindow: jest.fn(callback => {
    measureInput = callback;
  }),
};
const scrollTo = jest.fn();
const scrollViewRef = {
  current: {
    getScrollableNode: () => 10,
    getInnerViewNode: () => 11,
    scrollTo,
  } as unknown as BottomSheetScrollViewMethods,
};

const flushFrame = () =>
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(0));
  });
const showKeyboard = (screenY = 500) =>
  act(() => {
    listeners.get('keyboardDidShow')?.({
      endCoordinates: { height: 300, screenY },
    });
  });
const focus = (sheetId: string | undefined, id = 'amount') =>
  act(() => {
    perpsProKeyboardSession.focus({
      id,
      input,
      minimum: null,
      scrollTrade: false,
      sheetId,
    });
  });
const mountSheet = () => {
  const hook = renderHook(
    ({ visible }) => usePerpsProSheetKeyboard({ visible, scrollViewRef }),
    { initialProps: { visible: true } },
  );
  act(() => hook.result.current.onSheetReadyChange(true));
  focus(hook.result.current.sheetId);
  showKeyboard();
  return hook;
};

describe('Android sheet keyboard viewport (native geometry boundary)', () => {
  beforeEach(() => {
    mockAndroid = true;
    frames.clear();
    listeners.clear();
    jest.clearAllMocks();
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, callback) => {
        listeners.set(event, callback);
        return {
          remove: () => {
            listeners.delete(event);
          },
        };
      });
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => {
      frames.delete(id);
    });
    jest
      .spyOn(UIManager, 'measureInWindow')
      .mockImplementation((_node, callback) => {
        measureViewport = callback;
      });
    jest
      .spyOn(UIManager, 'measureLayout')
      .mockImplementation((_node, _relative, _failure, callback) => {
        measureContent = callback;
      });
    jest.spyOn(require('react-native'), 'findNodeHandle').mockReturnValue(12);
    Object.defineProperty(StatusBar, 'currentHeight', {
      configurable: true,
      value: 24,
    });
    perpsProKeyboardSession.setEnabled(true);
  });
  afterEach(() => {
    act(() => perpsProKeyboardSession.setEnabled(false));
    jest.restoreAllMocks();
  });

  it('reserves 48 only for its own input and an actually visible keyboard', () => {
    const { result } = renderHook(() =>
      usePerpsProSheetKeyboard({ visible: true, scrollViewRef }),
    );
    focus(result.current.sheetId);
    expect(result.current.accessoryInset).toBe(0);
    showKeyboard();
    expect(result.current.accessoryInset).toBe(48);
    focus('another-sheet');
    expect(result.current.accessoryInset).toBe(0);
    focus(undefined); // Main trade has another scroll owner.
    expect(result.current.accessoryInset).toBe(0);
    focus(result.current.sheetId);
    act(() => listeners.get('keyboardDidHide')?.());
    expect(result.current.accessoryInset).toBe(0);
  });

  it('uses the existing keyboard metrics when mounting above an open keyboard', () => {
    jest
      .spyOn(Keyboard, 'metrics')
      .mockReturnValue({ height: 300, screenY: 500, screenX: 0, width: 393 });
    const { result } = renderHook(() =>
      usePerpsProSheetKeyboard({ visible: true, scrollViewRef }),
    );
    focus(result.current.sheetId);
    expect(result.current.accessoryInset).toBe(48);
  });

  it('scrolls the full Amount field plus gap above Done after a warning grows the content', () => {
    const { result } = mountSheet();
    flushFrame();
    measureViewport(0, 100, 393, 400); // screen top 124, Done top 452
    measureInput(0, 350, 200, 40); // fully visible already
    expect(UIManager.measureLayout).not.toHaveBeenCalled();
    act(() => result.current.ensureInputVisible()); // onContentSizeChange/onLayout
    flushFrame();
    measureViewport(0, 100, 393, 400);
    measureInput(0, 420, 200, 40); // warning pushed the field down
    measureContent(0, 600, 200, 40);
    expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 320 });
  });

  it('respects a shorter scroll viewport as well as the Done bar boundary', () => {
    mountSheet();
    flushFrame();
    measureViewport(0, 100, 393, 200);
    measureInput(0, 310, 200, 40);
    measureContent(0, 600, 200, 40);
    expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 448 });
  });

  it('scrolls back up when switching to an input above the viewport', () => {
    mountSheet();
    flushFrame();
    measureViewport(0, 100, 393, 400);
    measureInput(0, 70, 200, 40);
    measureContent(0, 60, 200, 40);
    expect(scrollTo).toHaveBeenCalledWith({ animated: false, y: 52 });
  });

  it('waits for the actual sheet animation to settle and remeasures afterwards', () => {
    const { result } = mountSheet();
    act(() => result.current.onSheetReadyChange(false));
    act(() => result.current.ensureInputVisible());
    flushFrame();
    expect(UIManager.measureInWindow).not.toHaveBeenCalled();
    act(() => result.current.onSheetReadyChange(true));
    flushFrame();
    expect(UIManager.measureInWindow).toHaveBeenCalledTimes(1);
  });

  it.each([
    'refocus',
    'hide-keyboard',
    'hide-sheet',
    'unmount',
    'drag',
    'animate',
  ] as const)('rejects a late native measurement after %s', event => {
    const hook = mountSheet();
    flushFrame();
    measureViewport(0, 100, 393, 400);
    measureInput(0, 420, 200, 40);
    const finish = measureContent;
    if (event === 'refocus') {
      focus(hook.result.current.sheetId, 'price');
      focus(hook.result.current.sheetId, 'amount'); // A -> B -> A must still invalidate A's callback.
    } else if (event === 'hide-keyboard') {
      act(() => listeners.get('keyboardDidHide')?.());
    } else if (event === 'hide-sheet') {
      hook.rerender({ visible: false });
    } else if (event === 'unmount') {
      hook.unmount();
    } else if (event === 'drag') {
      act(() => hook.result.current.cancelMeasurement());
    } else {
      act(() => hook.result.current.onSheetReadyChange(false));
    }
    finish(0, 600, 200, 40);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not remeasure for a Min-only market update', () => {
    const hook = mountSheet();
    flushFrame();
    act(() => perpsProKeyboardSession.updateMinimum('amount', '15.35 USDC'));
    expect(frames.size).toBe(0);
    expect(hook.result.current.accessoryInset).toBe(48);
  });

  it('does not subscribe on iOS or a hidden Android sheet and cleans up on dismissal', () => {
    mockAndroid = false;
    const ios = renderHook(() =>
      usePerpsProSheetKeyboard({ visible: true, scrollViewRef }),
    );
    expect(listeners.size).toBe(0);
    ios.unmount();
    mockAndroid = true;
    const android = mountSheet();
    expect(listeners.size).toBe(2);
    android.rerender({ visible: false });
    expect(listeners.size).toBe(0);
    expect(frames.size).toBe(0);
    expect(android.result.current.accessoryInset).toBe(0);
  });
});
