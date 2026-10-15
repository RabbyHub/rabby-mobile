import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { WalletSuccessCard } from './index';

// Component contract: exercise the real visibility policy while replacing the
// native animation boundary. Device coverage still owns animation timing.
const mockWithDelay = jest.fn((_delay: number, _animation: unknown) => 0);
const mockWithTiming = jest.fn((value: number) => value);
const mockSharedValues: { value: number }[] = [];

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
jest.mock(
  'lottie-react-native',
  () => (props: { autoPlay: boolean }) =>
    require('react').createElement(require('react-native').View, {
      testID: 'success-lottie',
      ...props,
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
  expect(view.getByTestId('success-lottie').props.autoPlay).toBe(true);
});

it('keeps the first-import delayed entrance animation by default', () => {
  render(<WalletSuccessCard {...props} />);

  expect(mockWithDelay.mock.calls.map(([delay]) => delay)).toEqual([100, 800]);
  expect(mockWithTiming.mock.calls.map(([value]) => value)).toEqual([1, 1]);
});

it('does not hide the content again when a skipped-animation success screen remounts', () => {
  const first = render(<WalletSuccessCard {...props} autoPlay={false} />);
  first.unmount();
  mockSharedValues.length = 0;

  render(<WalletSuccessCard {...props} autoPlay={false} />);

  expect(mockSharedValues.map(value => value.value)).toEqual([1, 1]);
  expect(mockWithDelay).not.toHaveBeenCalled();
});
