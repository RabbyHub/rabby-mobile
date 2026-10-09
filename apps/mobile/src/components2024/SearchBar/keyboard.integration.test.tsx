import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import {
  TextInput as NativeTextInput,
  type TextInputProps as MockTextInputProps,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppBottomSheetTextInput } from '@/components/customized/BottomSheetTextInput';
import { NextSearchBar, type NextSearchBarMethods } from './index';

// JS integration: real SearchBar, sheet input and Typography cooperate. Native
// focus events and the Reanimated UI queue remain controlled process boundaries;
// this does not claim that a real device's keyboard or sheet animation was run.
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('react-native/Libraries/ReactNative/UIManager', () => ({
  __esModule: true,
  default: {
    ...require('react-native/jest/mocks/UIManager').default,
    measureInWindow: jest.fn(),
    measureLayout: jest.fn(),
  },
}));

type KeyboardState = {
  status: 'SHOWN' | 'HIDDEN';
  target?: number;
  height: number;
  heightWithinContainer: number;
  duration: number;
};
let mockKeyboardState: KeyboardState;
let mockExecutingUI = false;
let mockSheetContextAvailable = true;
const mockUIQueue: Array<() => void> = [];
const mockInputNodes = { current: new Set<number>() };
const mockKeyboard = {
  get: () => {
    if (!mockExecutingUI) {
      throw new Error('Keyboard state read on JS');
    }
    return mockKeyboardState;
  },
  set: (next: KeyboardState) => {
    if (!mockExecutingUI) {
      throw new Error('Keyboard snapshot written on JS');
    }
    mockKeyboardState = next;
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
  useBottomSheetInternal: () => {
    if (!mockSheetContextAvailable) {
      throw new Error('SearchBar requires an unexpected sheet context');
    }
    return {
      animatedKeyboardState: mockKeyboard,
      textInputNodesRef: mockInputNodes,
    };
  },
}));

let mockNextNode = 0;
const mockNativeClear = jest.fn();
jest.mock('react-native-gesture-handler', () => {
  const ReactModule = require('react') as typeof React;
  const {
    TextInput: Host,
    TouchableOpacity,
    TouchableWithoutFeedback,
  } = require('react-native') as typeof import('react-native');
  type MockNativeInputHandle = {
    _nativeTag: number;
    focus: jest.Mock;
    blur: jest.Mock;
    clear: jest.Mock;
  };
  return {
    ...jest.requireActual('react-native-gesture-handler'),
    TouchableOpacity,
    TouchableWithoutFeedback,
    TextInput: ReactModule.forwardRef<
      MockNativeInputHandle,
      MockTextInputProps
    >((props, ref) => {
      const host = ReactModule.useRef<MockNativeInputHandle | null>(null);
      if (!host.current) {
        host.current = {
          _nativeTag: ++mockNextNode,
          focus: jest.fn(),
          blur: jest.fn(),
          clear: mockNativeClear,
        };
      }
      const nativeHandle = host.current;
      nativeHandle.focus.mockImplementation(() => {
        props.onFocus?.({
          nativeEvent: { target: nativeHandle._nativeTag },
        } as Parameters<NonNullable<MockTextInputProps['onFocus']>>[0]);
      });
      nativeHandle.blur.mockImplementation(() => {
        props.onBlur?.({
          nativeEvent: { target: nativeHandle._nativeTag },
        } as Parameters<NonNullable<MockTextInputProps['onBlur']>>[0]);
      });
      ReactModule.useImperativeHandle(ref, () => nativeHandle);
      return ReactModule.createElement(Host, props);
    }),
  };
});

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
    mockKeyboardState = {
      ...mockKeyboardState,
      status: 'HIDDEN',
      duration: 0,
    };
  });
const focus = () => {
  fireEvent(screen.getByTestId('browser-search'), 'focus', {
    nativeEvent: { target: 1 },
  });
  flushUI();
};
const expectHiddenKeyboard = () => {
  expect(mockKeyboardState).toEqual({
    status: 'HIDDEN',
    target: undefined,
    height: 278,
    heightWithinContainer: 278,
    duration: 0,
  });
};

describe('Browser SearchBar sheet keyboard integration', () => {
  beforeEach(() => {
    mockNextNode = 0;
    mockNativeClear.mockClear();
    mockUIQueue.length = 0;
    mockInputNodes.current.clear();
    mockSheetContextAvailable = true;
    mockKeyboardState = {
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
    'preserves the hidden keyboard state and metadata with %s',
    ordering => {
      const onFocus = jest.fn();
      const onBlur = jest.fn();
      render(
        <NextSearchBar
          inputComponent={AppBottomSheetTextInput}
          testID="browser-search"
          value="1inch.com"
          onFocus={onFocus}
          onBlur={onBlur}
        />,
        { wrapper },
      );
      expect(screen.getByTestId('browser-search').props.allowFontScaling).toBe(
        false,
      );
      focus();
      expect(mockKeyboardState.target).toBe(1);
      expect(screen.getByText('global.Cancel')).toBeTruthy();
      if (ordering === 'hide-first') {
        queueHide();
      }
      fireEvent(screen.getByTestId('browser-search'), 'blur', {
        nativeEvent: { target: 1 },
      });
      if (ordering === 'blur-first') {
        queueHide();
      }
      flushUI();
      expectHiddenKeyboard();
      expect(screen.queryByText('global.Cancel')).toBeNull();
      expect(onFocus).toHaveBeenCalledTimes(1);
      expect(onBlur).toHaveBeenCalledTimes(1);
      expect(mockInputNodes.current).toEqual(new Set([1]));
    },
  );

  it.each(['hide-first', 'unmount-first'])(
    'releases the submitted search input without losing hide with %s',
    ordering => {
      const submitted = jest.fn();
      const Harness = () => {
        const [searchVisible, setSearchVisible] = React.useState(true);
        return searchVisible ? (
          <NextSearchBar
            as="BottomSheetTextInput"
            inputComponent={AppBottomSheetTextInput}
            testID="browser-search"
            value="1inch.com"
            onSubmitEditing={event => {
              submitted(event.nativeEvent.text);
              setSearchVisible(false);
            }}
          />
        ) : null;
      };
      render(<Harness />, { wrapper });
      focus();
      if (ordering === 'hide-first') {
        queueHide();
      }
      fireEvent(screen.getByTestId('browser-search'), 'submitEditing', {
        nativeEvent: { target: 1, text: '1inch.com' },
      });
      if (ordering === 'unmount-first') {
        queueHide();
      }
      expect(submitted).toHaveBeenCalledWith('1inch.com');
      expect(screen.queryByTestId('browser-search')).toBeNull();
      expect(mockInputNodes.current.size).toBe(0);
      flushUI();
      expectHiddenKeyboard();
    },
  );

  it.each(['hide-first', 'blur-first'])(
    'restores after Cancel and supports ref reopening with %s',
    ordering => {
      const ref = React.createRef<NextSearchBarMethods>();
      const events: string[] = [];
      render(
        <NextSearchBar
          ref={ref}
          as="BottomSheetTextInput"
          inputComponent={AppBottomSheetTextInput}
          testID="browser-search"
          value="1inch.com"
          onFocus={() => events.push('focus')}
          onBlur={() => events.push('blur')}
          onCancel={() => events.push('cancel')}
        />,
        { wrapper },
      );
      act(() => ref.current?.focus());
      flushUI();
      if (ordering === 'hide-first') {
        queueHide();
      }
      fireEvent.press(screen.getByText('global.Cancel'));
      if (ordering === 'blur-first') {
        queueHide();
      }
      flushUI();
      expectHiddenKeyboard();
      expect(events).toEqual(['focus', 'cancel', 'blur']);
      expect(screen.queryByText('global.Cancel')).toBeNull();
      expect(mockInputNodes.current).toEqual(new Set([1]));

      act(() => ref.current?.focus());
      mockUIQueue.push(() => {
        mockKeyboardState = {
          ...mockKeyboardState,
          status: 'SHOWN',
          duration: 250,
        };
      });
      flushUI();
      expect(mockKeyboardState).toMatchObject({ status: 'SHOWN', target: 1 });
      expect(screen.getByText('global.Cancel')).toBeTruthy();
      expect(events).toEqual(['focus', 'cancel', 'blur', 'focus']);
      expect(screen.getByTestId('browser-search').props.value).toBe(
        '1inch.com',
      );
      act(() => ref.current?.clear());
      expect(mockNativeClear).toHaveBeenCalledTimes(1);

      queueHide();
      act(() => ref.current?.blur());
      flushUI();
      expectHiddenKeyboard();
      expect(screen.queryByText('global.Cancel')).toBeNull();
    },
  );

  it('keeps the default TextInput path usable without a sheet context', () => {
    mockSheetContextAvailable = false;
    const onChangeText = jest.fn();
    render(
      <NextSearchBar
        testID="regular-search"
        value=""
        onChangeText={onChangeText}
      />,
      { wrapper },
    );
    const input = screen.getByTestId('regular-search');
    expect(input.props.allowFontScaling).toBe(false);
    fireEvent.changeText(input, '1inch.com');
    expect(onChangeText).toHaveBeenCalledWith('1inch.com');
    fireEvent(input, 'focus', { nativeEvent: { target: 42 } });
    expect(screen.getByText('global.Cancel')).toBeTruthy();
    fireEvent(input, 'blur', { nativeEvent: { target: 42 } });
    expect(screen.queryByText('global.Cancel')).toBeNull();
    expect(mockInputNodes.current.size).toBe(0);
    expect(mockUIQueue).toHaveLength(0);
  });
});
