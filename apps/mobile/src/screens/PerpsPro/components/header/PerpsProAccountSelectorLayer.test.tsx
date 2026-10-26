import { act, render, screen } from '@testing-library/react-native';
import React from 'react';

const mockLogin = jest.fn(async () => true);
const mockSetPopupState = jest.fn();
const mockUsePerpsState = jest.fn(() => ({
  currentPerpsAccount: {
    address: '0x0000000000000000000000000000000000000001',
    type: 'watch',
  },
  handleDeleteAgent: jest.fn(async () => undefined),
  login: mockLogin,
}));
let mockPopupState = {
  isShowDeleteAgentPopup: false,
  isShowLoginPopup: false,
};

jest.mock('@/hooks/perps/usePerpsState', () => ({
  usePerpsState: (...args: unknown[]) => mockUsePerpsState(...args),
}));

jest.mock('@/screens/Perps/hooks/usePerpsPopupState', () => ({
  usePerpsPopupState: () => [mockPopupState, mockSetPopupState],
}));

jest.mock('@/screens/Perps/components/PerpsAccountSelectorPopup', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    PerpsAccountSelectorPopup: (props: object) =>
      ReactModule.createElement(View, {
        ...props,
        testID: 'account-selector-popup',
      }),
  };
});

jest.mock('@/screens/Perps/components/PerpsAgentsLimitModal', () => ({
  PerpsAgentsLimitModal: () => null,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { PerpsProAccountSelectorLayer } from './PerpsProAccountSelectorLayer';

describe('PerpsProAccountSelectorLayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPopupState = {
      isShowDeleteAgentPopup: false,
      isShowLoginPopup: false,
    };
  });

  it('mounts the legacy login adapter only while the popup flow is visible', async () => {
    const view = render(<PerpsProAccountSelectorLayer />);
    expect(mockUsePerpsState).not.toHaveBeenCalled();

    view.unmount();
    mockPopupState = { ...mockPopupState, isShowLoginPopup: true };
    render(<PerpsProAccountSelectorLayer />);
    expect(mockUsePerpsState).toHaveBeenCalledWith({
      legacyRuntimeContinuationEnabled: false,
    });

    await act(async () => {
      await screen.getByTestId('account-selector-popup').props.onChange({
        address: '0x0000000000000000000000000000000000000002',
        type: 'watch',
      });
    });
    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockSetPopupState).toHaveBeenCalled();
  });
});
