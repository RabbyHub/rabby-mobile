import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@rneui/themed', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    Slider: (props: object) =>
      ReactModule.createElement(View, { ...props, testID: 'slider-input' }),
  };
});

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

import { PerpsProSlider } from './PerpsProSlider';

describe('PerpsProSlider neutral design', () => {
  it('masks the line with hollow points and uses a hollow custom thumb', () => {
    render(
      <PerpsProSlider
        hideMinimumPoint
        maximumValue={40}
        minimumValue={1}
        pointCount={5}
        tone="neutral"
        value={20}
      />,
    );

    expect(
      screen.getAllByTestId('perps-pro-slider-neutral-point'),
    ).toHaveLength(4);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-line',
      height: 1,
      left: 6.5,
      right: 6.5,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track-progress').props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-title-1',
      width: `${(19 / 39) * 100}%`,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb').props.style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-bg-1',
      borderColor: 'neutral-title-1',
      borderWidth: 1,
      height: 13,
      width: 13,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb-rail').props.style,
      ),
    ).toMatchObject({ left: 6.5, right: 6.5 });
    expect(screen.getByTestId('slider-input').props).toMatchObject({
      maximumTrackTintColor: 'transparent',
      minimumTrackTintColor: 'transparent',
    });
  });

  it('uses gray outlines after the current neutral progress', () => {
    render(
      <PerpsProSlider
        maximumValue={40}
        minimumValue={1}
        pointCount={5}
        tone="neutral"
        value={20}
      />,
    );

    const points = screen.getAllByTestId('perps-pro-slider-neutral-point');
    expect(points).toHaveLength(5);
    expect(StyleSheet.flatten(points[1].props.style)).toMatchObject({
      borderColor: 'neutral-title-1',
    });
    expect(StyleSheet.flatten(points[2].props.style)).toMatchObject({
      borderColor: 'neutral-line',
    });
    expect(StyleSheet.flatten(points[4].props.style)).toMatchObject({
      borderColor: 'neutral-line',
    });
  });
});
