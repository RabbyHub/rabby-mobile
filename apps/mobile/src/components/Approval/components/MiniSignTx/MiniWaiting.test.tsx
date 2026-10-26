import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

let mockBottomSheetOnDismiss: (() => void) | undefined;
const mockPresent = jest.fn();
const mockDismiss = jest.fn();
const mockSheetModalRef = {
  current: {
    present: mockPresent,
    dismiss: mockDismiss,
  },
};

jest.mock('@/components', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    AppBottomSheetModal: React.forwardRef(
      ({ children, onDismiss }: any, _ref: any) => {
        mockBottomSheetOnDismiss = onDismiss;
        return <View>{children}</View>;
      },
    ),
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetView: require('react-native').View,
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: {},
  }),
}));

jest.mock('@/hooks/useSheetModal', () => ({
  useSheetModal: () => ({
    sheetModalRef: mockSheetModalRef,
  }),
}));

jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));

jest.mock('./MiniLedgerHardwareWaiting', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    MiniLedgerHardwareWaiting: ({ onRetry }: { onRetry?: () => void }) => (
      <Pressable testID="ledger-retry" onPress={onRetry}>
        <Text>retry</Text>
      </Pressable>
    ),
  };
});

jest.mock('./MiniOneKeyHardwareWaiting', () => ({
  MiniOneKeyHardwareWaiting: () => null,
}));

jest.mock('./MiniPrivatekeyWaiting', () => ({
  MiniPrivatekeyWaiting: () => null,
}));

const { MiniWaiting } =
  require('./MiniWaiting') as typeof import('./MiniWaiting');

const ledgerAccount = {
  type: KEYRING_TYPE.LedgerKeyring,
} as any;

const failedError = {
  status: 'FAILED',
  content: 'Failed to Send',
  description: '0x6985',
} as any;

const renderMiniWaiting = ({
  onCancel = jest.fn(),
  onRetry = jest.fn(),
}: {
  onCancel?: jest.Mock;
  onRetry?: jest.Mock;
} = {}) => {
  render(
    <MiniWaiting
      visible
      account={ledgerAccount}
      error={failedError}
      onCancel={onCancel}
      onRetry={onRetry}
    />,
  );

  return { onCancel, onRetry };
};

describe('MiniWaiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBottomSheetOnDismiss = undefined;
  });

  it('does not cancel the signing flow when retry dismisses the error sheet', () => {
    const { onCancel, onRetry } = renderMiniWaiting();

    fireEvent.press(screen.getByTestId('ledger-retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    act(() => {
      mockBottomSheetOnDismiss?.();
    });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('still cancels when the visible error sheet is dismissed without retry', () => {
    const { onCancel } = renderMiniWaiting();

    act(() => {
      mockBottomSheetOnDismiss?.();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
