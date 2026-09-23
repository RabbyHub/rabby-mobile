import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import RNHelpers from '@/core/native/RNHelpers';
import { toast } from '@/components2024/Toast';
import { CopyAddressIcon } from './CopyAddress';

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));
jest.mock('@/core/native/RNHelpers', () => ({
  setSensitiveClipboard: jest.fn(),
}));
jest.mock('@/components2024/Toast', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock('@/hooks/theme', () => ({
  useThemeStyles: () => ({ colors: {} }),
}));
jest.mock('@/utils/styles', () => ({ createGetStyles: jest.fn() }));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('@/assets2024/icons/address/mcopy.svg', () => () => null);
jest.mock('i18next', () => ({ t: (key: string) => key }));

describe('CopyAddressIcon clipboard policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(RNHelpers.setSensitiveClipboard).mockResolvedValue();
  });

  it('keeps ordinary address copying on the standard clipboard', () => {
    const onToastSuccess = jest.fn();
    const view = render(
      <CopyAddressIcon
        address="0x1234"
        title="Copy"
        onToastSuccess={onToastSuccess}
      />,
    );

    fireEvent.press(view.getByText('Copy'));

    expect(Clipboard.setString).toHaveBeenCalledWith('0x1234');
    expect(RNHelpers.setSensitiveClipboard).not.toHaveBeenCalled();
    expect(onToastSuccess).toHaveBeenCalledWith({ address: '0x1234' });
  });

  it('copies secrets through the native policy without showing the secret in the toast', async () => {
    const view = render(
      <CopyAddressIcon sensitive address="test secret" title="Copy" />,
    );

    await act(async () => fireEvent.press(view.getByText('Copy')));

    expect(RNHelpers.setSensitiveClipboard).toHaveBeenCalledWith('test secret');
    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('global.copied');
  });

  it('waits for the native write before reporting success', async () => {
    let finishCopy!: () => void;
    jest.mocked(RNHelpers.setSensitiveClipboard).mockReturnValueOnce(
      new Promise<void>(resolve => {
        finishCopy = resolve;
      }),
    );
    const onToastSuccess = jest.fn();
    const view = render(
      <CopyAddressIcon
        sensitive
        address="test secret"
        title="Copy"
        onToastSuccess={onToastSuccess}
      />,
    );

    fireEvent.press(view.getByText('Copy'));
    expect(onToastSuccess).not.toHaveBeenCalled();
    await act(async () => finishCopy());
    expect(onToastSuccess).toHaveBeenCalledTimes(1);
  });

  it('reports a native failure without falling back to an unprotected copy', async () => {
    jest
      .mocked(RNHelpers.setSensitiveClipboard)
      .mockRejectedValueOnce(new Error('clipboard unavailable'));
    const onToastSuccess = jest.fn();
    const view = render(
      <CopyAddressIcon
        sensitive
        address="test secret"
        title="Copy"
        onToastSuccess={onToastSuccess}
      />,
    );

    await act(async () => fireEvent.press(view.getByText('Copy')));

    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(onToastSuccess).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Failed to copy');
  });

  it('does not overwrite the clipboard when the secret is missing', async () => {
    const view = render(<CopyAddressIcon sensitive title="Copy" />);

    await act(async () => fireEvent.press(view.getByText('Copy')));

    expect(RNHelpers.setSensitiveClipboard).not.toHaveBeenCalled();
    expect(Clipboard.setString).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
