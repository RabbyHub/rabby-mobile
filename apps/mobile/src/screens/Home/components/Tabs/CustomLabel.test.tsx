import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import type { SharedValue } from 'react-native-reanimated';

import CustomLabel from './CustomLabel';

jest.mock('react-native-reanimated', () => {
  const ReactNative = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ReactNative.View,
      Text: ReactNative.Text,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    clamp: (value: number, lower: number, upper: number) =>
      Math.min(Math.max(value, lower), upper),
    useAnimatedStyle: (callback: () => object) => callback(),
    useSharedValue: (value: unknown) => ({ value }),
  };
});

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
  AnimatedText: require('react-native').Text,
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (input: (context: object) => object) => ({
    getStyles: input,
  }),
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = new Proxy({}, { get: () => '#123456' });
    const isLight = true;
    return {
      colors2024,
      isLight,
      styles: getStyle.getStyles({ colors2024, isLight }),
    };
  },
}));

const track = (value: number) => ({ value } as SharedValue<number>);

describe('CustomLabel variants', () => {
  it('renders the single-address fade label as one text layer', () => {
    render(
      <CustomLabel
        index={0}
        indexDecimal={track(0)}
        text="Token"
        variant="fade"
      />,
    );

    expect(screen.getAllByText('Token')).toHaveLength(1);
    // Light mode active label sits on the near-black chip.
    expect(
      StyleSheet.flatten(screen.getByText('Token').props.style).color,
    ).toBe('rgba(247, 250, 252, 1)');
  });

  it('keeps the fade label inactive while another tab is active', () => {
    render(
      <CustomLabel
        index={1}
        indexDecimal={track(0)}
        text="DeFi"
        variant="fade"
      />,
    );

    expect(StyleSheet.flatten(screen.getByText('DeFi').props.style).color).toBe(
      '#123456',
    );
  });

  it('renders the multi-address moving plate with its pinned text layer', () => {
    render(<CustomLabel index={0} indexDecimal={track(1)} text="Token" />);

    // Grey label plus the white label inside the moving/clipped plate.
    expect(screen.getAllByText('Token')).toHaveLength(2);
  });
});
