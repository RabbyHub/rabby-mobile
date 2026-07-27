import React from 'react';
import { act, render } from '@testing-library/react-native';

import { WalletSuccessCard } from './index';

let mockLottieProps:
  | {
      autoPlay?: boolean;
      onAnimationFailure?: (error: string) => void;
      onAnimationFinish?: (isCancelled: boolean) => void;
    }
  | undefined;

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');

  return {
    useIsFocused: () => true,
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactModule.useEffect(callback, [callback]);
    },
  };
});

jest.mock('react-native-reanimated', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: React.PropsWithChildren<object>) =>
        ReactModule.createElement(
          View,
          { ...props, testID: 'animated-view' },
          children,
        ),
    },
    cancelAnimation: jest.fn(),
    Easing: {
      bezier: jest.fn(() => jest.fn()),
    },
    interpolate: (value: number) => value,
    useAnimatedStyle: (getStyle: () => object) => getStyle(),
    useSharedValue: (value: number) => ({ value }),
    withDelay: (_delay: number, value: number) => value,
    withTiming: (value: number) => value,
  };
});

jest.mock('lottie-react-native', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: (props: typeof mockLottieProps) => {
      mockLottieProps = props;
      return ReactModule.createElement(View, {
        testID: 'lottie-animation',
      });
    },
  };
});

jest.mock('@/components', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: new Proxy(
      {},
      {
        get: () => ({}),
      },
    ),
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: () => jest.fn(),
}));

jest.mock('../AddressCard', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');

  return {
    AddressCard: ({ address }: { address: string }) =>
      ReactModule.createElement(Text, null, address),
  };
});

jest.mock('@/assets/icons/address/seed-create-success.svg', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: () =>
      ReactModule.createElement(View, {
        testID: 'static-success-icon',
      }),
  };
});

const renderCard = (autoPlay = true, lottieAutoPlay = true) =>
  render(
    <WalletSuccessCard
      title="Wallet created"
      addresses={[
        {
          address: '0x1234',
          brandName: 'ETH',
        },
      ]}
      autoPlay={autoPlay}
      lottieAutoPlay={lottieAutoPlay}
    />,
  );

describe('WalletSuccessCard animation fallbacks', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLottieProps = undefined;
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('replaces Lottie with a static success icon when playback fails', () => {
    const screen = renderCard();

    act(() => {
      mockLottieProps?.onAnimationFailure?.('failed');
    });

    expect(screen.queryByTestId('lottie-animation')).toBeNull();
    expect(screen.getByTestId('static-success-icon')).toBeTruthy();
  });

  it('replaces Lottie with a static success icon when playback never finishes', () => {
    const screen = renderCard();

    act(() => {
      jest.advanceTimersByTime(4999);
    });
    expect(screen.getByTestId('lottie-animation')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId('lottie-animation')).toBeNull();
    expect(screen.getByTestId('static-success-icon')).toBeTruthy();
  });

  it('uses the timeout fallback when Lottie autoplay is disabled', () => {
    const screen = renderCard(true, false);

    expect(mockLottieProps?.autoPlay).toBe(false);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(screen.queryByTestId('lottie-animation')).toBeNull();
    expect(screen.getByTestId('static-success-icon')).toBeTruthy();
  });

  it('keeps the completed Lottie frame when playback finishes normally', () => {
    const screen = renderCard();

    act(() => {
      mockLottieProps?.onAnimationFinish?.(false);
      jest.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('lottie-animation')).toBeTruthy();
    expect(screen.queryByTestId('static-success-icon')).toBeNull();
  });

  it('renders visible content and a static success icon when autoplay is disabled', () => {
    const screen = renderCard(false);

    expect(screen.getAllByTestId('animated-view')).toHaveLength(2);
    expect(screen.getByText('Wallet created')).toBeTruthy();
    expect(screen.getByText('0x1234')).toBeTruthy();
    expect(screen.queryByTestId('lottie-animation')).toBeNull();
    expect(screen.getByTestId('static-success-icon')).toBeTruthy();
  });
});
