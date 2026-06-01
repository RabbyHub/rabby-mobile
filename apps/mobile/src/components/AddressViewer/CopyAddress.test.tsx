import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { CopyAddressIcon, toastCopyAddressSuccess } from './CopyAddress';
import { toast } from '@/components2024/Toast';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('@/components2024/Toast', () => ({
  toast: {
    success: jest.fn(),
  },
}));

jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));

jest.mock('@/hooks/theme', () => ({
  useThemeStyles: () => ({
    colors: {
      'neutral-foot': '#999999',
    },
  }),
}));

jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

describe('CopyAddressIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies the address and lets callers replace the success toast', () => {
    const onToastSuccess = jest.fn();
    const stopPropagation = jest.fn();

    render(
      <CopyAddressIcon
        address="0xAbC"
        onToastSuccess={onToastSuccess}
        icon={() => <>{null}</>}
        title="Copy"
      />,
    );

    fireEvent.press(screen.getByText('Copy'), { stopPropagation });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(Clipboard.setString).toHaveBeenCalledWith('0xAbC');
    expect(onToastSuccess).toHaveBeenCalledWith({ address: '0xAbC' });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not stop propagation or toast when address is missing', () => {
    const onToastSuccess = jest.fn();
    const stopPropagation = jest.fn();

    render(
      <CopyAddressIcon
        address={null}
        onToastSuccess={onToastSuccess}
        icon={() => <>{null}</>}
        title="Copy"
      />,
    );

    fireEvent.press(screen.getByText('Copy'), { stopPropagation });

    expect(stopPropagation).not.toHaveBeenCalled();
    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(onToastSuccess).not.toHaveBeenCalled();
  });
});

describe('toastCopyAddressSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a simple copied toast when no hash-like string is provided', () => {
    toastCopyAddressSuccess({ title: 'Copied account' });

    expect(toast.success).toHaveBeenCalledWith('Copied account');
  });

  it('uses custom toast content when an address is provided', () => {
    toastCopyAddressSuccess({
      hashLikeString: '0xabc',
      title: 'Copied address',
    });

    expect(toast.success).toHaveBeenCalledWith(expect.any(Function));
  });
});
