import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { WalletSuccessCard } from './index';

// Component contract: exercise the real visibility policy while replacing the
// native animation boundary. Device coverage still owns animation timing.
const mockWithDelay = jest.fn((_delay: number, _animation: unknown) => 0);
const mockWithTiming = jest.fn((value: number) => value);
const mockSharedValues: { value: number }[] = [];
const mockLottiePlay = jest.fn();
const mockLottieReset = jest.fn();

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  useSharedValue: (initial: number) => {
    const value = require('react').useRef({ value: initial }).current;
    mockSharedValues.push(value);
    return value;
  },
  useAnimatedStyle: (factory: () => unknown) => factory(),
  withDelay: (...args: [number, unknown]) => mockWithDelay(...args),
  withTiming: (value: number) => mockWithTiming(value),
  cancelAnimation: jest.fn(),
  Easing: { bezier: () => 'test-easing' },
  interpolate: (value: number, _input: number[], output: number[]) =>
    output[0] + value * (output[1] - output[0]),
}));
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) =>
    require('react').useEffect(effect, [effect]),
}));
jest.mock('lottie-react-native', () =>
  require('react').forwardRef((props: object, ref: React.Ref<unknown>) => {
    require('react').useImperativeHandle(ref, () => ({
      play: mockLottiePlay,
      reset: mockLottieReset,
    }));
    return require('react').createElement(require('react-native').View, {
      testID: 'success-lottie',
      ...props,
    });
  }),
);
jest.mock('@/components', () => ({ Text: require('react-native').Text }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: {} }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (style: unknown) => style,
}));
jest.mock('../AddressCard', () => ({ AddressCard: () => null }));

const props = {
  title: 'Wallets added',
  addresses: [
    {
      address: '0x0000000000000000000000000000000000000001',
      brandName: 'test',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSharedValues.length = 0;
});

it('shows the title and addresses on the first render when animation is skipped', () => {
  const view = render(<WalletSuccessCard {...props} autoPlay={false} />);
  const opacities = view
    .UNSAFE_getAllByType(View)
    .map(node => StyleSheet.flatten(node.props.style)?.opacity)
    .filter(value => value !== undefined);

  expect(opacities).toEqual([1, 1]);
  expect(mockSharedValues.map(value => value.value)).toEqual([1, 1]);
  expect(mockWithDelay).not.toHaveBeenCalled();
  // A skipped animation still shows the settled result, but never plays.
  expect(view.getByTestId('success-lottie').props.progress).toBe(1);
  expect(view.getByTestId('success-lottie').props.speed).toBe(0);
  expect(view.getByTestId('success-lottie').props.autoPlay).toBe(false);
});

it('keeps the first-import delayed entrance animation by default', () => {
  const view = render(<WalletSuccessCard {...props} />);

  expect(mockWithDelay.mock.calls.map(([delay]) => delay)).toEqual([100, 800]);
  expect(mockWithTiming.mock.calls.map(([value]) => value)).toEqual([1, 1]);
  expect(view.getByTestId('success-lottie').props.autoPlay).toBe(false);
  expect(view.getByTestId('success-lottie').props.speed).toBe(1);
  // Frame zero, but a non-zero value so Fabric forwards the prop to the
  // recycled native view instead of diffing it away.
  const progress = view.getByTestId('success-lottie').props.progress;
  expect(typeof progress).toBe('number');
  expect(progress).toBeGreaterThan(0);
  expect(progress).toBeLessThan(0.01);
  expect(mockLottiePlay).not.toHaveBeenCalled();
});

it('starts the lottie exactly once from frame 0 when it is laid out', () => {
  const view = render(
    <WalletSuccessCard
      {...props}
      addresses={[
        {
          address: '0x00000000000000000000000000000000000000bb',
          brandName: 'test',
        },
      ]}
    />,
  );
  const lottie = view.getByTestId('success-lottie');
  const layout = {
    nativeEvent: { layout: { x: 0, y: 0, width: 210, height: 190 } },
  };

  act(() => {
    fireEvent(lottie, 'layout', layout);
    fireEvent(lottie, 'layout', layout);
  });

  expect(mockLottieReset).toHaveBeenCalledTimes(1);
  expect(mockLottiePlay).toHaveBeenCalledTimes(1);
  expect(mockLottiePlay).toHaveBeenCalledWith(0, 400);
});

it('sends a distinct frame-zero progress per mounted card', () => {
  const first = render(
    <WalletSuccessCard
      {...props}
      addresses={[
        {
          address: '0x00000000000000000000000000000000000000c1',
          brandName: 'test',
        },
      ]}
    />,
  ).getByTestId('success-lottie').props.progress;
  const second = render(
    <WalletSuccessCard
      {...props}
      addresses={[
        {
          address: '0x00000000000000000000000000000000000000c2',
          brandName: 'test',
        },
      ]}
    />,
  ).getByTestId('success-lottie').props.progress;

  expect(first).not.toBe(second);
});

it('does not hide the content again when a skipped-animation success screen remounts', () => {
  const first = render(<WalletSuccessCard {...props} autoPlay={false} />);
  first.unmount();
  mockSharedValues.length = 0;

  const second = render(<WalletSuccessCard {...props} autoPlay={false} />);

  expect(mockSharedValues.map(value => value.value)).toEqual([1, 1]);
  expect(mockWithDelay).not.toHaveBeenCalled();
  expect(second.getByTestId('success-lottie').props.progress).toBe(1);
});

it('does not replay the entrance when the same success result mounts twice', () => {
  const remountProps = {
    ...props,
    addresses: [
      {
        address: '0x00000000000000000000000000000000000000aa',
        brandName: 'test',
      },
    ],
  };

  const first = render(<WalletSuccessCard {...remountProps} />);
  expect(mockWithDelay).toHaveBeenCalledTimes(2);
  first.unmount();

  mockWithDelay.mockClear();
  mockWithTiming.mockClear();
  mockSharedValues.length = 0;

  const second = render(<WalletSuccessCard {...remountProps} />);
  expect(mockWithDelay).not.toHaveBeenCalled();
  expect(mockWithTiming).not.toHaveBeenCalled();
  expect(mockSharedValues.map(value => value.value)).toEqual([1, 1]);
  expect(second.getByTestId('success-lottie').props.progress).toBe(1);
});
