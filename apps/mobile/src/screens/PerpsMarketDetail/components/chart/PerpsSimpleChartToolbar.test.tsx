import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { trigger } from 'react-native-haptic-feedback';
import {
  DEFAULT_SIMPLE_CHART_PREFERENCE,
  SIMPLE_CHART_RANGES,
  SIMPLE_RANGE_INTERVAL,
  type SimpleChartPreference,
} from '@/constant/perpsSimpleChart';
import { PerpsSimpleChartToolbar } from './PerpsSimpleChartToolbar';
import { StyleSheet, View } from 'react-native';

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/interval.svg',
  () => () => null,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/chevron.svg',
  () => () => null,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/area.svg',
  () => () => null,
);
jest.mock(
  '@/assets2024/icons/perps/PerpsSimpleChart/candle.svg',
  () => () => null,
);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => {
    const colors2024 = require('@/constant/theme').ThemeColors2024.dark;
    return {
      colors2024,
      styles: getStyle.getStyles({ colors2024, isLight: false }),
    };
  },
}));

it('keeps each rounded background native before pending or first selection', () => {
  const props = {
    onChange: jest.fn(),
    onInterval: jest.fn(),
    onPrefetch: jest.fn(),
  };
  const initial = DEFAULT_SIMPLE_CHART_PREFERENCE;
  const view = render(
    <PerpsSimpleChartToolbar {...props} preference={initial} />,
  );
  const names = [
    ...SIMPLE_CHART_RANGES,
    'page.perpsDetail.simpleChart.intervalTitle',
  ];
  const background = (name: string) =>
    view
      .getAllByRole('button', { name })
      // The manual 1d interval also displays "1D"; its explicit label identifies
      // the interval entry, while range buttons are named by their text.
      .find(button =>
        name === 'page.perpsDetail.simpleChart.intervalTitle'
          ? button.props.accessibilityLabel === name
          : !button.props.accessibilityLabel,
      )!
      .findAllByType(View)
      .find(node => StyleSheet.flatten(node.props.style)?.borderRadius === 6)!;
  const hosts = names.map(name => {
    const host = background(name);
    expect(host.props.collapsable).toBe(false);
    return host;
  });
  const selections: SimpleChartPreference[] = [
    ...SIMPLE_CHART_RANGES.map(range => ({
      ...initial,
      range,
      interval: SIMPLE_RANGE_INTERVAL[range],
    })),
    { ...initial, range: null, interval: '1h' },
  ];
  for (const selection of selections) {
    // Pending opacity previously promoted an incomplete layout-only host.
    view.rerender(
      <PerpsSimpleChartToolbar
        {...props}
        preference={initial}
        requestedPreference={selection}
      />,
    );
    view.rerender(
      <PerpsSimpleChartToolbar {...props} preference={selection} />,
    );
    names.forEach((name, index) => {
      expect(background(name)).toBe(hosts[index]);
      expect(background(name).props.collapsable).toBe(false);
    });
    const selectedName = selection.range ?? names[names.length - 1];
    expect(
      StyleSheet.flatten(background(selectedName).props.style).backgroundColor,
    ).toBeTruthy();
  }
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it('gives one light haptic on each toolbar press, never on prefetch', () => {
  jest.mocked(trigger).mockClear();
  const change = jest.fn();
  const open = jest.fn();
  const prefetch = jest.fn();
  const view = render(
    <PerpsSimpleChartToolbar
      preference={DEFAULT_SIMPLE_CHART_PREFERENCE}
      onChange={change}
      onInterval={open}
      onPrefetch={prefetch}
    />,
  );
  fireEvent(view.getByText('1W'), 'pressIn');
  expect(prefetch).toHaveBeenCalledWith('4h');
  expect(trigger).not.toHaveBeenCalled();
  fireEvent.press(
    view.getByRole('button', {
      name: 'page.perpsDetail.simpleChart.intervalTitle',
    }),
  );
  expect(open).toHaveBeenCalledTimes(1);
  fireEvent.press(view.getByText('1W'));
  expect(change).toHaveBeenLastCalledWith({
    ...DEFAULT_SIMPLE_CHART_PREFERENCE,
    range: '1W',
    interval: '4h',
  });
  fireEvent.press(
    view.getByRole('button', {
      name: 'page.perpsDetail.simpleChart.switchToArea',
    }),
  );
  expect(change).toHaveBeenLastCalledWith({
    ...DEFAULT_SIMPLE_CHART_PREFERENCE,
    style: 'area',
  });
  expect(trigger).toHaveBeenCalledTimes(3);
});

it('keeps the applied range selected while exposing immediate pending feedback in real 40px targets', () => {
  const change = jest.fn();
  const view = render(
    <PerpsSimpleChartToolbar
      preference={DEFAULT_SIMPLE_CHART_PREFERENCE}
      requestedPreference={{
        ...DEFAULT_SIMPLE_CHART_PREFERENCE,
        range: '1W',
        interval: '4h',
      }}
      onChange={change}
      onInterval={() => {}}
      onPrefetch={() => {}}
    />,
  );
  const requested = view.getByRole('button', { name: '1W' });
  const applied = view.getByRole('button', { name: '1D' });
  expect(requested.props.accessibilityState).toMatchObject({
    selected: false,
    busy: true,
  });
  expect(applied.props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(requested.props.style).height).toBe(40);
  expect(
    view
      .UNSAFE_getAllByType(View)
      .some(node => StyleSheet.flatten(node.props.style)?.opacity === 0.6),
  ).toBe(true);
  fireEvent.press(
    view.getByRole('button', {
      name: 'page.perpsDetail.simpleChart.switchToArea',
    }),
  );
  expect(change).toHaveBeenCalledWith({
    ...DEFAULT_SIMPLE_CHART_PREFERENCE,
    style: 'area',
    range: '1W',
    interval: '4h',
  });
});
