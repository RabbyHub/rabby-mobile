import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { CameraView } from './QRCodeScanner';

let mockDevice: object | undefined = { id: 'back' };
let mockAppState = 'active';
let mockColors = {
  'neutral-black': '#000000',
  'neutral-line': '#E0E5EC',
};

jest.mock('@/hooks/theme', () => ({
  useThemeColors: () => mockColors,
}));
jest.mock('@react-native-community/hooks', () => ({
  useAppState: () => mockAppState,
}));
jest.mock('../Text', () => ({ Text: require('react-native').Text }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  interpolate: jest.fn(() => 0),
  useAnimatedStyle: (getStyle: () => object) => getStyle(),
  useSharedValue: (value: number) => require('react').useRef({ value }).current,
  withRepeat: jest.fn(),
  withTiming: jest.fn(),
}));
jest.mock('react-native-vision-camera', () => ({
  Camera: ({ children, ...props }: any) => {
    const NativeView = require('react-native').View;
    return (
      <NativeView {...props} testID="camera-preview">
        {children}
      </NativeView>
    );
  },
  useCameraDevice: () => mockDevice,
  useCodeScanner: (options: unknown) => options,
}));

// Component contract: the real scanner owns its loading backgrounds and
// activation delay; native preview rendering still requires an iOS check.
describe('QR scanner preview background', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockDevice = { id: 'back' };
    mockAppState = 'active';
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['#E0E5EC', '#333333'])(
    'keeps every preview layer black before camera activation with border %s',
    borderColor => {
      mockColors = {
        'neutral-black': '#000000',
        'neutral-line': borderColor,
      };
      render(<CameraView containerStyle={{ width: 320, height: 320 }} />);

      const layers = screen.UNSAFE_getAllByType(View);
      expect(layers).toHaveLength(3);
      layers.forEach(layer => {
        expect(StyleSheet.flatten(layer.props.style).backgroundColor).toBe(
          '#000000',
        );
      });
      expect(StyleSheet.flatten(layers[0].props.style)).toMatchObject({
        width: 320,
        height: 320,
        borderColor,
      });
      expect(screen.getByTestId('camera-preview').props.isActive).toBe(false);
    },
  );

  it('keeps the aperture black while a camera device is unavailable', () => {
    mockDevice = undefined;
    render(<CameraView />);

    expect(screen.getByText('No Camera Device')).toBeTruthy();
    expect(screen.queryByTestId('camera-preview')).toBeNull();
    expect(
      StyleSheet.flatten(screen.UNSAFE_getByType(View).props.style)
        .backgroundColor,
    ).toBe('#000000');
  });

  it('preserves delayed activation, background pause and scan delivery', () => {
    const onCodeScanned = jest.fn();
    const view = render(<CameraView onCodeScanned={onCodeScanned} />);

    act(() => jest.advanceTimersByTime(499));
    expect(screen.getByTestId('camera-preview').props.isActive).toBe(false);
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('camera-preview').props.isActive).toBe(true);

    const publicCodes = [{ value: 'non-secret-test-result' }];
    act(() => {
      screen
        .getByTestId('camera-preview')
        .props.codeScanner.onCodeScanned(publicCodes);
    });
    expect(onCodeScanned).toHaveBeenCalledWith(publicCodes);

    mockAppState = 'background';
    view.rerender(<CameraView onCodeScanned={onCodeScanned} />);
    expect(screen.getByTestId('camera-preview').props.isActive).toBe(false);
  });
});
