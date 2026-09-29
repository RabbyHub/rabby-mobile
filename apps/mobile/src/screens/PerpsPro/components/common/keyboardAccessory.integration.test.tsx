import React from 'react';
import {
  act,
  cleanupAsync,
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { AppState, Keyboard, Platform, TextInput, View } from 'react-native';
import { Portal, PortalProvider } from '@gorhom/portal';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Keep the actual Portal, session, input registration and sheet viewport hook.
// Only native keyboard/input hosts and navigation/animation boundaries are replaced.
jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock('@gorhom/bottom-sheet', () => ({
  ...require('@gorhom/bottom-sheet/mock'),
  useBottomSheetModalInternal: () => ({ hostName: 'root' }),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

const platform = Platform.OS;
Platform.OS = 'android';
const { PerpsProKeyboardAccessory } =
  require('./PerpsProKeyboardAccessory') as typeof import('./PerpsProKeyboardAccessory');
const { PerpsProKeyboardSheetContext } =
  require('./PerpsProKeyboardSheetContext') as typeof import('./PerpsProKeyboardSheetContext');
const { usePerpsProKeyboardInput } =
  require('./usePerpsProKeyboardInput') as typeof import('./usePerpsProKeyboardInput');
const { usePerpsProSheetKeyboard } =
  require('./usePerpsProSheetKeyboard') as typeof import('./usePerpsProSheetKeyboard');
const { perpsProKeyboardSession } =
  require('./perpsProKeyboardSession') as typeof import('./perpsProKeyboardSession');

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}>
    <PortalProvider>{children}</PortalProvider>
  </SafeAreaProvider>
);

const nativeInputs = new Map<
  string,
  { blur: jest.Mock; isFocused: () => boolean; measureInWindow: jest.Mock }
>();
let nativeFocused: string | null = null;
const Input = ({ id }: { id: string }) => {
  const ref = React.useRef({
    blur: jest.fn(() => {
      nativeFocused = null;
    }),
    isFocused: () => nativeFocused === id,
    measureInWindow: jest.fn(),
  });
  nativeInputs.set(id, ref.current);
  const keyboard = usePerpsProKeyboardInput(ref);
  return <TextInput testID={id} {...keyboard} />;
};
const Sheet = ({ id, visible = true }: { id: string; visible?: boolean }) => {
  const scrollViewRef = React.useRef(null);
  const keyboard = usePerpsProSheetKeyboard({ visible, scrollViewRef });
  return (
    <Portal name={id}>
      <View
        key={id}
        testID={id}
        style={{ marginBottom: keyboard.accessoryInset }}>
        <PerpsProKeyboardSheetContext.Provider value={keyboard.sheetId}>
          <Input id={`${id}-price`} />
          <Input id={`${id}-pnl`} />
        </PerpsProKeyboardSheetContext.Provider>
      </View>
    </Portal>
  );
};
const listeners = new Map<string, Set<(event: any) => void>>();
const emit = (event: string) =>
  act(() => {
    jest
      .mocked(Keyboard.metrics)
      .mockReturnValue(
        event === 'keyboardDidShow'
          ? { height: 300, screenY: 560, screenX: 0, width: 393 }
          : undefined,
      );
    listeners
      .get(event)
      ?.forEach(callback =>
        callback({ endCoordinates: { height: 300, screenY: 560 } }),
      );
  });
const focus = (id: string) => {
  nativeFocused = id;
  fireEvent(screen.getByTestId(id), 'focus');
};
const blur = (id: string) => {
  nativeFocused = null;
  fireEvent(screen.getByTestId(id), 'blur');
};

describe('Android Done presentation and real focus cooperation', () => {
  const appState = AppState.currentState;
  beforeEach(() => {
    AppState.currentState = 'active';
    nativeInputs.clear();
    nativeFocused = null;
    listeners.clear();
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
    jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    jest
      .spyOn(Keyboard, 'addListener')
      .mockImplementation((event, callback) => {
        const group = listeners.get(event) ?? new Set();
        group.add(callback);
        listeners.set(event, group);
        return {
          remove: () => {
            group.delete(callback);
          },
        };
      });
    jest.spyOn(global, 'requestAnimationFrame').mockReturnValue(1);
    jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await cleanupAsync();
    act(() => perpsProKeyboardSession.setEnabled(false));
    jest.restoreAllMocks();
    AppState.currentState = appState;
  });
  afterAll(() => {
    Platform.OS = platform;
  });

  it('keeps one overlay and 48pt inset during Price -> PnL transfer, then Done blurs only PnL', () => {
    render(
      <>
        <Sheet id="tpsl" />
        <PerpsProKeyboardAccessory />
      </>,
      { wrapper },
    );
    focus('tpsl-price');
    emit('keyboardDidShow');
    const nativeOverlay = screen
      .UNSAFE_getAllByType(View)
      .find(
        node => node.props.testID === 'perps-pro-keyboard-overlay',
      )!.instance;
    nativeOverlay.measureInWindow.mockImplementation(
      (callback: Parameters<View['measureInWindow']>[0]) =>
        callback(0, 0, 393, 852),
    );
    fireEvent(screen.getByTestId('perps-pro-keyboard-overlay'), 'layout');
    const overlay = screen.getByTestId('perps-pro-keyboard-overlay');
    expect(screen.getByTestId('tpsl')).toHaveStyle({ marginBottom: 48 });
    blur('tpsl-price');
    expect(perpsProKeyboardSession.getSnapshot()).toBeNull();
    expect(screen.getByTestId('perps-pro-keyboard-overlay')).toBe(overlay);
    expect(screen.getByTestId('tpsl')).toHaveStyle({ marginBottom: 48 });
    focus('tpsl-pnl');
    expect(screen.getByTestId('perps-pro-keyboard-overlay')).toBe(overlay);
    expect(screen.getByTestId('tpsl')).toHaveStyle({ marginBottom: 48 });
    fireEvent.press(screen.getByTestId('perps-pro-keyboard-done'));
    expect(nativeInputs.get('tpsl-price')!.blur).not.toHaveBeenCalled();
    expect(nativeInputs.get('tpsl-pnl')!.blur).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tpsl')).toHaveStyle({ marginBottom: 0 });
    expect(screen.queryByTestId('perps-pro-keyboard-overlay')).toBeNull();
  });

  it('re-layers above a new sheet and ignores cleanup from the old surface', () => {
    const view = render(
      <>
        <Sheet id="tpsl" />
        <PerpsProKeyboardAccessory />
      </>,
      { wrapper },
    );
    focus('tpsl-price');
    emit('keyboardDidShow');
    const oldPresentation = perpsProKeyboardSession.getAndroidPresentation();
    view.rerender(
      <>
        <Sheet id="tpsl" />
        <PerpsProKeyboardAccessory />
        <Sheet id="margin" />
      </>,
    );
    focus('margin-price');
    expect(perpsProKeyboardSession.getAndroidPresentation()).not.toBe(
      oldPresentation,
    );
    expect(screen.getByTestId('tpsl')).toHaveStyle({ marginBottom: 0 });
    expect(screen.getByTestId('margin')).toHaveStyle({ marginBottom: 48 });
    const rendered = view.toJSON() as {
      children: Array<{ props: { testID?: string } }>;
    };
    expect(rendered.children.slice(-2).map(node => node.props.testID)).toEqual([
      'margin',
      'perps-pro-keyboard-overlay',
    ]);
    view.rerender(
      <>
        <Sheet id="tpsl" visible={false} />
        <PerpsProKeyboardAccessory />
        <Sheet id="margin" />
      </>,
    );
    expect(screen.getByTestId('margin')).toHaveStyle({ marginBottom: 48 });
    blur('margin-price');
    view.rerender(
      <>
        <Sheet id="tpsl" visible={false} />
        <PerpsProKeyboardAccessory />
      </>,
    );
    expect(perpsProKeyboardSession.getAndroidPresentation()).toBeNull();
    expect(screen.queryByTestId('perps-pro-keyboard-overlay')).toBeNull();
  });
});
