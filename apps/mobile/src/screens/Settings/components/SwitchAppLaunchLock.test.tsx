import React from 'react';
import { act, render } from '@testing-library/react-native';

import { SwitchAppLaunchLock } from './SwitchAppLaunchLock';

jest.mock('@/components/customized/Switch2024', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  return {
    AppSwitch2024: (props: Record<string, unknown>) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'app-launch-lock-switch',
      }),
  };
});

jest.mock('@/core/apis/lock', () => ({
  appLaunchLockEvent: {
    addListener: jest.fn(),
    off: jest.fn(),
  },
  isAppLaunchLockEnabled: jest.fn(() => false),
  setAppLaunchLockEnabled: jest.fn(),
}));

const mockLockApi = jest.requireMock('@/core/apis/lock') as {
  isAppLaunchLockEnabled: jest.Mock;
  setAppLaunchLockEnabled: jest.Mock;
};

describe('SwitchAppLaunchLock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLockApi.isAppLaunchLockEnabled.mockReturnValue(false);
  });

  it('does not persist an enabled state when the pre-toggle guard rejects it', () => {
    const onBeforeToggle = jest.fn(() => false);
    const screen = render(
      <SwitchAppLaunchLock onBeforeToggle={onBeforeToggle} />,
    );

    act(() => {
      screen.getByTestId('app-launch-lock-switch').props.onValueChange(true);
    });

    expect(onBeforeToggle).toHaveBeenCalledWith(true);
    expect(mockLockApi.setAppLaunchLockEnabled).not.toHaveBeenCalled();
  });

  it('persists the requested state when the pre-toggle guard allows it', () => {
    const onBeforeToggle = jest.fn(() => true);
    const screen = render(
      <SwitchAppLaunchLock onBeforeToggle={onBeforeToggle} />,
    );

    act(() => {
      screen.getByTestId('app-launch-lock-switch').props.onValueChange(true);
    });

    expect(mockLockApi.setAppLaunchLockEnabled).toHaveBeenCalledWith(true);
  });
});
