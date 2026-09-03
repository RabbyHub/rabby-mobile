import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: require('react-native').View },
  cancelAnimation: jest.fn(),
  useAnimatedStyle: (factory: () => object) => factory(),
}));

import {
  getPerpsProTabIndicatorFrame,
  PerpsProTabIndicator,
} from './PerpsProTabIndicator';

describe('PerpsProTabIndicator', () => {
  const layouts = [
    { width: 20, x: 10 },
    { width: 40, x: 50 },
    { width: 30, x: 120 },
  ];

  it('interpolates every adjacent indicator frame in both directions', () => {
    const positions = [1, 1.25, 1.5, 1.75, 2];
    const frames = [
      { width: 40, x: 50 },
      { width: 37.5, x: 67.5 },
      { width: 35, x: 85 },
      { width: 32.5, x: 102.5 },
      { width: 30, x: 120 },
    ];

    expect(
      positions.map(position =>
        getPerpsProTabIndicatorFrame(position, layouts),
      ),
    ).toEqual(frames);
    expect(
      [...positions]
        .reverse()
        .map(position => getPerpsProTabIndicatorFrame(position, layouts)),
    ).toEqual([...frames].reverse());
  });

  it('updates horizontal position and width through layout props together', () => {
    const position = { value: 1.5 } as SharedValue<number>;

    render(
      React.createElement(PerpsProTabIndicator, {
        layouts,
        position,
        testID: 'indicator',
      }),
    );

    const style = StyleSheet.flatten(
      screen.getByTestId('indicator', { includeHiddenElements: true }).props
        .style,
    );
    expect(style).toMatchObject({
      left: 85,
      opacity: 1,
      position: 'absolute',
      width: 35,
    });
    expect(style).not.toHaveProperty('transform');
  });

  it('clamps invalid and out-of-range pager positions', () => {
    expect(getPerpsProTabIndicatorFrame(-1, layouts)).toEqual(layouts[0]);
    expect(getPerpsProTabIndicatorFrame(4, layouts)).toEqual(layouts[2]);
    expect(getPerpsProTabIndicatorFrame(Number.NaN, layouts)).toEqual(
      layouts[0],
    );
    expect(getPerpsProTabIndicatorFrame(1, [])).toEqual({ width: 0, x: 0 });
  });
});
