import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: { getStyle: (input: object) => object }) => {
    const colors2024 = new Proxy({}, { get: (_target, key) => String(key) });
    return { styles: getStyle({ colors2024 }) };
  },
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import {
  PerpsProHistoryTabs,
  updatePerpsProHistoryTabFrame,
} from './PerpsProHistoryTabs';

describe('PerpsProHistoryTabs', () => {
  it('renders all compact tabs and keeps selection controlled', () => {
    const onChange = jest.fn();
    const view = render(
      <PerpsProHistoryTabs activeTab="orders" onChange={onChange} />,
    );

    expect(
      screen.getByTestId('perps-pro-history-tab-orders').props
        .accessibilityState,
    ).toEqual({ selected: true });
    fireEvent.press(screen.getByTestId('perps-pro-history-tab-funding'));
    expect(onChange).toHaveBeenCalledWith('funding');

    view.rerender(
      <PerpsProHistoryTabs activeTab="funding" onChange={onChange} />,
    );
    expect(
      screen.getByTestId('perps-pro-history-tab-funding').props
        .accessibilityState,
    ).toEqual({ selected: true });
    expect(
      screen.getByText('page.perps.pro.history.tabs.transaction'),
    ).toBeTruthy();
  });

  it('snapshots native layout before a deferred state updater runs', () => {
    type SetTabFrames = Parameters<typeof updatePerpsProHistoryTabFrame>[2];
    type TabFramesUpdate = Parameters<SetTabFrames>[0];
    let deferredUpdate: TabFramesUpdate | undefined;
    const setTabFrames: SetTabFrames = update => {
      deferredUpdate = update;
    };
    const pooledEvent: {
      nativeEvent: {
        layout: { height: number; width: number; x: number; y: number };
      } | null;
    } = {
      nativeEvent: {
        layout: { height: 34, width: 112, x: 208, y: 0 },
      },
    };

    updatePerpsProHistoryTabFrame(
      'transaction',
      pooledEvent as Parameters<typeof updatePerpsProHistoryTabFrame>[1],
      setTabFrames,
    );
    pooledEvent.nativeEvent = null;

    expect(typeof deferredUpdate).toBe('function');
    if (typeof deferredUpdate !== 'function') {
      throw new Error('Expected a deferred tab-frame state updater');
    }
    const previous = {};
    const next = deferredUpdate(previous);
    expect(next).toEqual({
      transaction: { height: 34, width: 112, x: 208, y: 0 },
    });
    expect(deferredUpdate(next)).toBe(next);
  });
});
