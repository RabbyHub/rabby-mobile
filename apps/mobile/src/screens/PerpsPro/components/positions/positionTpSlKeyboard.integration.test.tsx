import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { Platform, TextInput as NativeTextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { TextInput } from '@/components/Typography';

// Real adapter, Typography, Decimal and keyboard session; only native hosts and
// animation scheduling are substituted. A synchronous SharedValue mock would
// hide the lost keyboard update this suite is intended to prevent.
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));

type KeyboardState = {
  status: 'SHOWN' | 'HIDDEN';
  target?: number;
  height: number;
  heightWithinContainer: number;
  duration: number;
};
let mockState: KeyboardState;
let mockExecutingUI = false;
const mockUIQueue: Array<() => void> = [];
const mockNodes = { current: new Set<number>() };
const mockKeyboard = {
  get: () => {
    if (!mockExecutingUI) {
      throw new Error('Keyboard state read on JS');
    }
    return mockState;
  },
  set: (next: KeyboardState) => {
    if (!mockExecutingUI) {
      throw new Error('Keyboard snapshot written on JS');
    }
    mockState = next;
  },
};
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  runOnUI:
    (callback: (...args: unknown[]) => void) =>
    (...args: unknown[]) =>
      mockUIQueue.push(() => callback(...args)),
}));
jest.mock('@gorhom/bottom-sheet', () => ({
  ...require('@gorhom/bottom-sheet/mock'),
  useBottomSheetInternal: () => ({
    animatedKeyboardState: mockKeyboard,
    textInputNodesRef: mockNodes,
  }),
}));

const mockSetSelection = jest.fn();
let mockNextNode = 0;
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react');
  const { TextInput: Host } = require('react-native');
  return {
    ...jest.requireActual('react-native-gesture-handler'),
    TextInput: ReactModule.forwardRef((props: object, ref: unknown) => {
      const host = ReactModule.useRef(null);
      if (!host.current) {
        host.current = {
          _nativeTag: ++mockNextNode,
          focus: jest.fn(),
          blur: jest.fn(),
          setNativeProps: jest.fn(),
          setSelection: mockSetSelection,
        };
      }
      ReactModule.useImperativeHandle(ref, () => host.current);
      return ReactModule.createElement(Host, props);
    }),
  };
});

// The integration setup has already loaded react-native; choose the platform
// before importing the real feature, without manufacturing a second runtime.
const originalPlatform = Platform.OS;
Object.defineProperty(Platform, 'OS', {
  configurable: true,
  value: 'android',
});
const { PerpsProPositionTpSlBottomSheetTextInput } =
  require('./PerpsProPositionTpSlBottomSheetTextInput') as typeof import('./PerpsProPositionTpSlBottomSheetTextInput');
const { PerpsProPositionTpSlInput } =
  require('./PerpsProPositionTpSlInput') as typeof import('./PerpsProPositionTpSlInput');
afterAll(() =>
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: originalPlatform,
  }),
);
const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    {children}
  </SafeAreaProvider>
);

const flushUI = () => {
  mockExecutingUI = true;
  try {
    while (mockUIQueue.length) {
      mockUIQueue.shift()!();
    }
  } finally {
    mockExecutingUI = false;
  }
};
const queueHide = () =>
  mockUIQueue.push(() => {
    mockState = { ...mockState, status: 'HIDDEN', duration: 0 };
  });
const focus = (id: string, node: number) =>
  fireEvent(screen.getByTestId(id), 'focus', { nativeEvent: { target: node } });
const blur = (id: string, node: number) =>
  fireEvent(screen.getByTestId(id), 'blur', { nativeEvent: { target: node } });

describe('Android TP/SL keyboard ownership', () => {
  beforeEach(() => {
    mockNextNode = 0;
    mockUIQueue.length = 0;
    mockNodes.current.clear();
    mockState = {
      status: 'SHOWN',
      height: 278,
      heightWithinContainer: 278,
      duration: 250,
    };
    jest
      .spyOn(NativeTextInput.State, 'currentlyFocusedInput')
      .mockReturnValue(null);
  });
  afterEach(async () => {
    await cleanupAsync();
    flushUI();
    jest.restoreAllMocks();
  });

  it.each(['hide-first', 'blur-first'])(
    'preserves HIDDEN and the latest keyboard metadata with %s',
    order => {
      const onBlur = jest.fn();
      render(
        <PerpsProPositionTpSlBottomSheetTextInput
          testID="input"
          onBlur={onBlur}
        />,
      );
      focus('input', 1);
      flushUI();
      expect(mockState.target).toBe(1);
      if (order === 'hide-first') {
        queueHide();
      }
      blur('input', 1);
      if (order === 'blur-first') {
        queueHide();
      }
      expect(mockState.status).toBe('SHOWN');
      flushUI();
      expect(mockState).toEqual({
        status: 'HIDDEN',
        target: undefined,
        height: 278,
        heightWithinContainer: 278,
        duration: 0,
      });
      expect(onBlur).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps a newer focus when an old input blurs before the UI queue drains', () => {
    render(
      <>
        <PerpsProPositionTpSlBottomSheetTextInput testID="old" />
        <PerpsProPositionTpSlBottomSheetTextInput testID="new" />
      </>,
    );
    focus('old', 1);
    flushUI();
    queueHide();
    focus('new', 2);
    blur('old', 1);
    flushUI();
    expect(mockState).toMatchObject({
      status: 'HIDDEN',
      target: 2,
      duration: 0,
    });
  });

  it('preserves the registered-input hand-off before the new focus event arrives', () => {
    const ref = React.createRef<TextInput>();
    render(
      <>
        <PerpsProPositionTpSlBottomSheetTextInput testID="old" />
        <PerpsProPositionTpSlBottomSheetTextInput ref={ref} testID="new" />
      </>,
    );
    expect(mockNodes.current).toEqual(new Set([1, 2]));
    focus('old', 1);
    flushUI();
    jest
      .mocked(NativeTextInput.State.currentlyFocusedInput)
      .mockReturnValue(ref.current);
    blur('old', 1);
    flushUI();
    expect(mockState.target).toBe(1);
    focus('new', 2);
    flushUI();
    expect(mockState.target).toBe(2);
  });

  it.each(['hide-first', 'unmount-first'])(
    'unregisters an unmounted native ref without losing hide (%s)',
    order => {
      const ref = React.createRef<TextInput>();
      const view = render(
        <PerpsProPositionTpSlBottomSheetTextInput ref={ref} testID="input" />,
      );
      focus('input', 1);
      flushUI();
      if (order === 'hide-first') {
        queueHide();
      }
      view.unmount();
      expect(ref.current).toBeNull();
      expect(mockNodes.current.size).toBe(0);
      if (order === 'unmount-first') {
        queueHide();
      }
      flushUI();
      expect(mockState).toMatchObject({
        status: 'HIDDEN',
        target: undefined,
        duration: 0,
      });
    },
  );

  it('does not let cleanup from the previous field clear a reopened field', () => {
    const view = render(
      <View>
        <PerpsProPositionTpSlBottomSheetTextInput key="old" testID="input" />
      </View>,
    );
    focus('input', 1);
    flushUI();
    view.rerender(
      <View>
        <PerpsProPositionTpSlBottomSheetTextInput key="new" testID="input" />
      </View>,
    );
    focus('input', 2);
    flushUI();
    expect(mockState.target).toBe(2);
    expect(mockNodes.current).toEqual(new Set([2]));
  });

  it('hides the mirror caret until one native end command and releases middle editing', () => {
    const onChange = jest.fn();
    render(
      <PerpsProPositionTpSlInput
        accessibilityLabel="PnL"
        disabled={false}
        label="PnL"
        maxDecimals={2}
        negative
        onChangeText={onChange}
        testID="input"
        value="1234.5"
      />,
      { wrapper },
    );
    expect(screen.getByText('−1,234.5')).toBeTruthy();
    expect(screen.getByTestId('input').props.caretHidden).toBe(true);
    mockSetSelection.mockImplementationOnce(() => {
      expect(screen.getByTestId('input').props.caretHidden).toBe(true);
      expect(screen.getByText('−1,234.5')).toBeTruthy();
    });
    focus('input', 1);
    flushUI();
    expect(mockSetSelection).toHaveBeenLastCalledWith(6, 6);
    expect(screen.getByTestId('input').props.caretHidden).toBe(false);
    expect(screen.queryByText('−1,234.5')).toBeNull();
    expect(screen.getByTestId('input').props.selection).toBeUndefined();
    fireEvent(screen.getByTestId('input'), 'selectionChange', {
      nativeEvent: { selection: { start: 2, end: 2 } },
    });
    fireEvent.changeText(screen.getByTestId('input'), '12934.5');
    expect(onChange).toHaveBeenLastCalledWith('12934.5');
    expect(screen.getByTestId('input').props.selection).toBeUndefined();
    queueHide();
    blur('input', 1);
    act(flushUI);
    expect(mockState).toMatchObject({ status: 'HIDDEN', target: undefined });
    expect(screen.getByTestId('input').props.caretHidden).toBe(true);
    expect(screen.getByTestId('input').props.selection).toBeUndefined();
    focus('input', 1);
    expect(mockSetSelection).toHaveBeenLastCalledWith(7, 7);
  });
});
