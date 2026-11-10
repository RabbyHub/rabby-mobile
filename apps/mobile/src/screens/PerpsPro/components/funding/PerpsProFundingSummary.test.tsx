import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { colors2024, styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === 'page.perps.pro.funding.summary'
        ? 'Funding (1h) / Countdown'
        : key,
  }),
}));

import { PerpsProFundingSummary } from './PerpsProFundingSummary';
import type { PerpsServerClockSample } from '../../model/funding';

describe('PerpsProFundingSummary', () => {
  it('keeps the funding field on one semantic-font line', () => {
    render(
      <PerpsProFundingSummary
        market={null}
        onPress={jest.fn()}
        serverClock={null}
      />,
    );

    const label = screen.getByText('Funding (1h) / Countdown');
    expect(label.props.numberOfLines).toBe(1);
    expect(StyleSheet.flatten(label.props.style)).toMatchObject({
      fontFamily: 'SF Pro Rounded',
      fontSize: 10,
      fontWeight: '500',
      lineHeight: 12,
    });
    expect(StyleSheet.flatten(label.parent?.parent?.props.style)).toMatchObject(
      {
        flexShrink: 0,
        minWidth: 136,
      },
    );
    for (const value of ['-', '--:--']) {
      const text = screen.getByText(value);
      expect(text.props.adjustsFontSizeToFit).toBeUndefined();
      expect(StyleSheet.flatten(text.props.style)).toMatchObject({
        fontSize: 10,
        lineHeight: 12,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
      });
    }
  });
});

describe('PerpsProFundingSummary countdown publication', () => {
  const hour = 60 * 60 * 1000;
  const localNow = 100_000;
  const onPress = jest.fn();
  const summary = (serverClock: PerpsServerClockSample | null) => (
    <PerpsProFundingSummary
      market={null}
      onPress={onPress}
      serverClock={serverClock}
    />
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(localNow);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('applies new clock samples in one commit without restarting the one-second timer', () => {
    const startTimer = jest.spyOn(global, 'setInterval');
    const stopTimer = jest.spyOn(global, 'clearInterval');
    const onRender = jest.fn();
    const view = render(
      <React.Profiler id="countdown" onRender={onRender}>
        {summary({ receivedAt: localNow, serverTime: 10.5 * hour })}
      </React.Profiler>,
    );
    expect(screen.getByText('00:30:00')).toBeTruthy();
    expect(onRender).toHaveBeenCalledTimes(1);

    for (let update = 1; update <= 3; update++) {
      jest.setSystemTime(localNow + update * 100);
      onRender.mockClear();
      view.rerender(
        <React.Profiler id="countdown" onRender={onRender}>
          {summary({
            receivedAt: localNow + update * 100 - 10,
            serverTime: 10.5 * hour + update * 1000,
          })}
        </React.Profiler>,
      );
      expect(screen.getByText(`00:29:${59 - update}`)).toBeTruthy();
      expect(onRender).toHaveBeenCalledTimes(1);
      expect(startTimer).toHaveBeenCalledTimes(1);
      expect(stopTimer).not.toHaveBeenCalled();
    }
    view.unmount();
    expect(stopTimer).toHaveBeenCalledTimes(1);
  });

  it('ticks from the latest sample, rolls over the hour, and catches up after a clock jump', () => {
    const view = render(
      summary({ receivedAt: localNow, serverTime: 11 * hour - 2000 }),
    );
    expect(screen.getByText('00:00:02')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText('00:00:01')).toBeTruthy();

    view.rerender(
      summary({ receivedAt: Date.now(), serverTime: 11 * hour - 10_000 }),
    );
    expect(screen.getByText('00:00:10')).toBeTruthy();
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText('00:00:09')).toBeTruthy();
    act(() => jest.advanceTimersByTime(9000));
    expect(screen.getByText('01:00:00')).toBeTruthy();

    // A suspended app must catch up from wall time, not from the tick count.
    jest.setSystemTime(Date.now() + 5 * 60 * 1000);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText('00:54:59')).toBeTruthy();
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cleans up when the sample disappears and starts one timer when it returns', () => {
    const startTimer = jest.spyOn(global, 'setInterval');
    const view = render(summary(null));
    expect(screen.getByText('--:--')).toBeTruthy();
    expect(startTimer).not.toHaveBeenCalled();

    view.rerender(summary({ receivedAt: localNow, serverTime: 10.5 * hour }));
    expect(screen.getByText('00:30:00')).toBeTruthy();
    expect(jest.getTimerCount()).toBe(1);
    view.rerender(summary(null));
    expect(screen.getByText('--:--')).toBeTruthy();
    expect(jest.getTimerCount()).toBe(0);
    act(() => jest.advanceTimersByTime(5000));

    // A different feed's valid sample must not inherit the previous clock.
    view.rerender(
      summary({ receivedAt: Date.now(), serverTime: 14.75 * hour }),
    );
    expect(screen.getByText('00:15:00')).toBeTruthy();
    expect(startTimer).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(1);
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves future-receive-time clamping and invalid-clock placeholders', () => {
    const view = render(
      summary({ receivedAt: localNow + 5000, serverTime: 10.5 * hour }),
    );
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByText('00:30:00')).toBeTruthy();
    view.rerender(summary({ receivedAt: Date.now(), serverTime: NaN }));
    expect(screen.getByText('--:--')).toBeTruthy();
    view.rerender(summary({ receivedAt: NaN, serverTime: 10.5 * hour }));
    expect(screen.getByText('--:--')).toBeTruthy();
    view.unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
