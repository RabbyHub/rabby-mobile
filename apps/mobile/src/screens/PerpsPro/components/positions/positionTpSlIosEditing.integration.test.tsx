import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('@ledgerhq/react-native-hw-transport-ble', () => ({}));
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
const mockSetSelection = jest.fn();
const mockSetNativeProps = jest.fn();
const mockFocus = jest.fn();
const mockMount = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { TextInput } = require('react-native');
  return {
    ...require('@gorhom/bottom-sheet/mock'),
    BottomSheetTextInput: ReactModule.forwardRef(
      (props: object, ref: unknown) => {
        ReactModule.useImperativeHandle(
          ref,
          () => ({
            focus: mockFocus,
            setSelection: mockSetSelection,
            setNativeProps: mockSetNativeProps,
          }),
          [],
        );
        ReactModule.useEffect(() => {
          mockMount();
        }, []);
        return ReactModule.createElement(TextInput, props);
      },
    ),
  };
});

import { PerpsProPositionTpSlInput } from './PerpsProPositionTpSlInput';

const wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 393, height: 852 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
    {children}
  </SafeAreaProvider>
);
const Editor = ({
  initialValue,
  label,
}: {
  initialValue: string;
  label: string;
}) => {
  const [value, setValue] = React.useState(initialValue);
  return (
    <PerpsProPositionTpSlInput
      accessibilityLabel={label}
      disabled={false}
      label={label}
      maxDecimals={2}
      onChangeText={setValue}
      testID="input"
      value={value}
    />
  );
};
beforeEach(() => jest.clearAllMocks());

it.each(['Price', 'PnL', 'ROI'])(
  'hands %s selection to iOS after one focus command, including deletion and middle editing',
  label => {
    render(<Editor initialValue="1234.5" label={label} />, { wrapper });
    const input = screen.getByTestId('input');
    const proxy = screen.getByTestId('input-focus-proxy');
    fireEvent.press(proxy);
    expect(mockFocus).toHaveBeenCalledTimes(1);
    fireEvent(input, 'focus', { nativeEvent: {} });
    expect(mockSetSelection).toHaveBeenCalledTimes(1);
    expect(mockSetSelection).toHaveBeenLastCalledWith(6, 6);
    expect(proxy.props.accessibilityState.disabled).toBe(true);
    fireEvent.press(proxy);
    expect(mockFocus).toHaveBeenCalledTimes(1);
    // A delayed native selection notification must not queue a second end write.
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { start: 0, end: 0 } },
    });
    fireEvent(input, 'keyPress', { nativeEvent: { key: 'Backspace' } });
    fireEvent.changeText(input, '1234.');
    fireEvent(input, 'selectionChange', {
      nativeEvent: { selection: { start: 2, end: 2 } },
    });
    fireEvent.changeText(input, '12934.');
    expect(input.props.value).toBe('12934.');
    expect(input.props.selection).toBeUndefined();
    expect(mockSetSelection).toHaveBeenCalledTimes(1);
    expect(mockSetNativeProps).not.toHaveBeenCalled();
    expect(screen.getByTestId('input')).toBe(input);
    expect(mockMount).toHaveBeenCalledTimes(1);
    fireEvent(input, 'blur', { nativeEvent: {} });
    expect(proxy.props.accessibilityState.disabled).toBe(false);
    fireEvent(input, 'focus', { nativeEvent: {} });
    expect(mockSetSelection).toHaveBeenCalledTimes(2);
  },
);

it('does not queue an empty iOS selection that can race the first typed digit', () => {
  render(<Editor initialValue="" label="Price" />, { wrapper });
  const input = screen.getByTestId('input');
  fireEvent(input, 'focus', { nativeEvent: {} });
  fireEvent.changeText(input, '1');
  fireEvent.changeText(input, '12');
  fireEvent(input, 'selectionChange', {
    nativeEvent: { selection: { start: 0, end: 0 } },
  });
  expect(input.props.value).toBe('12');
  expect(input.props.selection).toBeUndefined();
  expect(mockSetSelection).not.toHaveBeenCalled();
  expect(mockSetNativeProps).not.toHaveBeenCalled();
});
