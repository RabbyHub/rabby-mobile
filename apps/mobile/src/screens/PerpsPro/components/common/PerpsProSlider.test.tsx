jest.mock('@/assets2024/icons/perps/PerpsProDialogSliderPoint.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, {
      ...props,
      testID: 'dialog-slider-point-svg',
    });
});
jest.mock('@/assets2024/icons/perps/PerpsProLeverageThumb.svg', () => {
  const ReactModule = require('react');
  return (props: object) =>
    ReactModule.createElement(require('react-native').View, props);
});
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
  it.each([1, 40])(
    'aligns the opt-in leverage thumb and input at endpoint %i',
    value => {
      const onValueChange = jest.fn();
      render(
        <PerpsProSlider
          appearance="leverage-dialog"
          maximumValue={40}
          minimumValue={1}
          onValueChange={onValueChange}
          showPoints={false}
          tone="neutral"
          value={value}
        />,
      );
      const input = screen.getByTestId('slider-input');
      expect(input.props.onValueChange).toBe(onValueChange);
      expect(StyleSheet.flatten(input.props.style)).toMatchObject({
        height: 48,
        marginHorizontal: 3,
      });
      expect(StyleSheet.flatten(input.props.thumbStyle)).toMatchObject({
        width: 20,
        height: 20,
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-slider-neutral-thumb-rail').props.style,
        ),
      ).toMatchObject({ left: 3, right: 23, top: 14 });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-slider-neutral-thumb').props.style,
        ),
      ).toMatchObject({
        width: 20,
        height: 20,
        left: value === 1 ? '0%' : '100%',
      });
      expect(
        StyleSheet.flatten(
          screen.getByTestId('perps-pro-slider-neutral-track-progress-rail')
            .props.style,
        ),
      ).toMatchObject({ left: 13, right: 13, height: 4 });
    },
  );

  it('matches the 32/2/16/8 neutral geometry with aligned rails', () => {
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
      height: 2,
      left: 0,
      right: 0,
      top: 15,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track-progress').props
          .style,
      ),
    ).toMatchObject({
      backgroundColor: 'neutral-title-1',
      height: 2,
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
      height: 16,
      width: 16,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb-rail').props.style,
      ),
    ).toMatchObject({ left: 0, right: 16, top: 8 });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track-progress-rail').props
          .style,
      ),
    ).toMatchObject({ height: 2, left: 8, right: 8, top: 15 });
    expect(
      StyleSheet.flatten(
        screen.getAllByTestId('perps-pro-slider-neutral-point')[0].props.style,
      ),
    ).toMatchObject({ height: 8, width: 8 });
    expect(screen.getByTestId('slider-input').props).toMatchObject({
      maximumTrackTintColor: 'transparent',
      minimumTrackTintColor: 'transparent',
    });
  });

  it('can remove all fixed points while retaining the draggable thumb', () => {
    render(<PerpsProSlider showPoints={false} tone="neutral" value={20} />);

    expect(
      screen.queryAllByTestId('perps-pro-slider-neutral-point'),
    ).toHaveLength(0);
    expect(screen.getByTestId('perps-pro-slider-neutral-thumb')).toBeTruthy();
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

  it('forwards optional gesture lifecycle callbacks without enabling behavior by default', () => {
    const onSlidingComplete = jest.fn();
    const onSlidingStart = jest.fn();
    const onValueChange = jest.fn();
    render(
      <PerpsProSlider
        onSlidingComplete={onSlidingComplete}
        onSlidingStart={onSlidingStart}
        onValueChange={onValueChange}
        value={20}
      />,
    );

    expect(screen.getByTestId('slider-input').props).toMatchObject({
      onSlidingComplete,
      onSlidingStart,
      onValueChange,
    });
  });

  it('keeps the default disabled appearance for existing callers', () => {
    render(<PerpsProSlider disabled tone="neutral" value={20} />);

    expect(screen.getByTestId('slider-input').props).toMatchObject({
      allowTouchTrack: false,
      disabled: true,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'neutral-secondary' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track-progress').props
          .style,
      ),
    ).toMatchObject({ backgroundColor: 'neutral-secondary' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb').props.style,
      ),
    ).toMatchObject({ borderColor: 'neutral-secondary' });
  });

  it('can disable interaction without dimming the leverage slider colors', () => {
    render(
      <PerpsProSlider
        disabled
        dimWhenDisabled={false}
        tone="neutral"
        value={20}
      />,
    );

    expect(screen.getByTestId('slider-input').props).toMatchObject({
      allowTouchTrack: false,
      disabled: true,
    });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track').props.style,
      ),
    ).toMatchObject({ backgroundColor: 'neutral-line' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-track-progress').props
          .style,
      ),
    ).toMatchObject({ backgroundColor: 'neutral-title-1' });
    expect(
      StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb').props.style,
      ),
    ).toMatchObject({ borderColor: 'neutral-title-1' });
  });
});

describe('order dialog slider coordinates', () => {
  it.each([0, 25, 50, 75, 100])(
    'keeps the native touch rail, SVG thumb and point aligned at %i%%',
    value => {
      const onValueChange = jest.fn();
      const onSlidingStart = jest.fn();
      const onSlidingComplete = jest.fn();
      render(
        <PerpsProSlider
          appearance="order-dialog"
          tone="neutral"
          pointCount={5}
          value={value}
          onValueChange={onValueChange}
          onSlidingStart={onSlidingStart}
          onSlidingComplete={onSlidingComplete}
        />,
      );
      const input = screen.getByTestId('slider-input');
      expect(input.props).toMatchObject({
        minimumValue: 0,
        maximumValue: 100,
        step: 1,
        onValueChange,
        onSlidingStart,
        onSlidingComplete,
        allowTouchTrack: true,
      });
      const inputStyle = StyleSheet.flatten(input.props.style);
      const nativeThumb = StyleSheet.flatten(input.props.thumbStyle);
      const rail = StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb-rail').props.style,
      );
      const thumb = StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-neutral-thumb').props.style,
      );
      const points = screen.getAllByTestId('perps-pro-slider-neutral-point');
      const pointStyle = StyleSheet.flatten(points[value / 25].props.style);
      const pointRail = StyleSheet.flatten(
        screen.getByTestId('perps-pro-slider-points').props.style,
      );
      for (const width of [304, 329, 366]) {
        const nativeCenter =
          inputStyle.marginHorizontal +
          nativeThumb.width / 2 +
          ((width - 2 * inputStyle.marginHorizontal - nativeThumb.width) *
            value) /
            100;
        const visualCenter =
          rail.left +
          thumb.width / 2 +
          ((width - rail.left - rail.right) * parseFloat(thumb.left)) / 100;
        const pointCenter =
          pointRail.left +
          4 +
          ((width - pointRail.left - pointRail.right) *
            parseFloat(pointStyle.left)) /
            100;
        expect(nativeCenter).toBeCloseTo(4 + ((width - 8) * value) / 100);
        expect(visualCenter).toBeCloseTo(nativeCenter);
        expect(pointCenter).toBeCloseTo(nativeCenter);
      }
      expect(inputStyle.height).toBe(40);
      expect(rail.top + thumb.height / 2).toBe(20);
      expect(pointRail.top + 4).toBe(20);
      const glyphs = screen.getAllByTestId('dialog-slider-point-svg');
      glyphs.forEach((glyph, index) =>
        expect(glyph.props).toMatchObject({
          width: 8,
          height: 8,
          fill: 'neutral-bg-1',
          color: index * 25 <= value ? 'neutral-title-1' : 'neutral-info',
        }),
      );
    },
  );
});
