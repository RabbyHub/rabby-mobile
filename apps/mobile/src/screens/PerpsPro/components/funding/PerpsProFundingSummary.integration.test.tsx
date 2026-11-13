import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { createStoreActivityScope } from '@/core/state/storeActivity';
import { StoreActivityProvider } from '@/hooks/storeActivity/StoreActivityProvider';
import { PerpsProFundingSummary } from './PerpsProFundingSummary';

// Real Summary, theme/typography, countdown model, activity hook, Provider and
// scope cooperate here. Only the integration lane's native/network boundaries
// and the wall clock are fake; no repository-internal module is replaced.
it('resumes a retained funding summary from current wall time through its real activity scope', () => {
  jest.useFakeTimers();
  const hour = 60 * 60 * 1000;
  const localNow = 100_000;
  jest.setSystemTime(localNow);
  const scope = createStoreActivityScope({
    active: false,
    label: 'funding-summary-integration',
  });
  const onRender = jest.fn();
  const view = render(
    <SafeAreaInsetsContext.Provider
      value={{ top: 0, right: 0, bottom: 0, left: 0 }}>
      <StoreActivityProvider scope={scope}>
        <React.Profiler id="funding-summary" onRender={onRender}>
          <PerpsProFundingSummary
            market={null}
            onPress={jest.fn()}
            serverClock={{ receivedAt: localNow, serverTime: 11 * hour - 2000 }}
          />
        </React.Profiler>
      </StoreActivityProvider>
    </SafeAreaInsetsContext.Provider>,
  );
  try {
    expect(view.getByText('00:00:02')).toBeTruthy();
    expect(jest.getTimerCount()).toBe(0);
    onRender.mockClear();
    act(() => jest.advanceTimersByTime(5000));
    expect(onRender).not.toHaveBeenCalled();
    expect(view.getByText('00:00:02')).toBeTruthy();

    act(() => scope.setActive(true));
    expect(view.getByText('00:59:57')).toBeTruthy();
    expect(onRender).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
    act(() => jest.advanceTimersByTime(1000));
    expect(view.getByText('00:59:56')).toBeTruthy();

    act(() => scope.setActive(false));
    expect(jest.getTimerCount()).toBe(0);
    onRender.mockClear();
    act(() => jest.advanceTimersByTime(5000));
    expect(onRender).not.toHaveBeenCalled();
    expect(view.getByText('00:59:56')).toBeTruthy();
  } finally {
    view.unmount();
    scope.dispose();
    jest.useRealTimers();
  }
});
