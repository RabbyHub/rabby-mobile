import React from 'react';
import { ScrollView, Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ApprovalPopupContainer } from './ApprovalPopupContainer';
import { MiniApprovalPopupContainer } from './MiniApprovalPopupContainer';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: ({ getStyle }: any) => ({
    styles: getStyle({ colors: {}, colors2024: {} }),
    colors2024: {},
  }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/hooks/useApprovalPopup', () => ({
  useApprovalPopup: () => ({ snapToIndexPopup: jest.fn() }),
}));
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('./FooterResend', () => ({
  FooterResend: ({ onResend }: { onResend: () => void }) => {
    const Native = require('react-native');
    return (
      <Native.Pressable onPress={onResend}>
        <Native.Text>Retry</Native.Text>
      </Native.Pressable>
    );
  },
}));
jest.mock('./FooterButton', () => ({ FooterButton: () => null }));
jest.mock('./FooterDoneButton', () => ({ FooterDoneButton: () => null }));
jest.mock('./FooterResendCancelGroup', () => ({
  FooterResendCancelGroup: ({ onResend }: { onResend: () => void }) => {
    const Native = require('react-native');
    return (
      <Native.Pressable onPress={onResend}>
        <Native.Text>Retry after failure</Native.Text>
      </Native.Pressable>
    );
  },
}));
jest.mock('./MiniFooterResendCancelGroup', () => ({
  MiniFooterResendCancelGroup: () => null,
}));
jest.mock('./Dots', () => ({ Dots: () => null }));
jest.mock('@/assets/icons/approval/tx-succeed.svg', () => () => null);
jest.mock('@/assets2024/icons/common/failed-retry.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-wired.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-wireless.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-ble.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-ledger.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-qrcode.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-keystone.svg', () => () => null);
jest.mock('@/assets/icons/approval/connect-onekey.svg', () => () => null);

// Component structure only: actual Fabric layout/scroll-indicator behavior
// still needs verification on the Android and iOS validation packages.
describe.each([
  ['regular', ApprovalPopupContainer],
  ['mini', MiniApprovalPopupContainer],
] as const)('%s approval popup', (_name, Container) => {
  it.each([
    ['SENDING', undefined],
    ['SENDING', ''],
    ['RESOLVED', undefined],
    ['RESOLVED', ''],
    ['SUBMITTING', undefined],
    ['SUBMITTING', ''],
  ] as const)(
    'uses a plain spacer for %s without a description (%s)',
    (status, description) => {
      render(
        <Container
          hdType="privatekey"
          status={status}
          content={() => <Text>Ready to sign</Text>}
          description={description}
        />,
      );
      expect(screen.getByText('Ready to sign')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    },
  );

  it('removes the error description scroll view when a retry succeeds', () => {
    const view = render(
      <Container
        hdType="privatekey"
        status="FAILED"
        content={() => <Text>Transaction failed</Text>}
        description="Retry this transaction"
      />,
    );
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);

    for (const status of ['SENDING', 'RESOLVED'] as const) {
      view.rerender(
        <Container
          hdType="privatekey"
          status={status}
          content={() => <Text>{status}</Text>}
          description=""
        />,
      );
      expect(screen.getByText(status)).toBeTruthy();
      expect(screen.queryByText('Retry this transaction')).toBeNull();
      expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    }
  });

  it('keeps nonempty descriptions scrollable without a vertical indicator', () => {
    render(
      <Container
        hdType="privatekey"
        status="SUBMITTING"
        content={() => <Text>Ready to sign</Text>}
        description="Review the transaction"
      />,
    );
    expect(screen.getByText('Review the transaction')).toBeTruthy();
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    expect(scrollView.props.showsVerticalScrollIndicator).toBe(false);
  });
});

describe('QR hardware signature submission', () => {
  it.each(['SENDING', 'FAILED', 'RESOLVED'] as const)(
    'provides the status color on the very first %s render',
    status => {
      const content = jest.fn((_props: { contentColor: string }) => (
        <Text>Signature status</Text>
      ));
      const view = render(
        <ApprovalPopupContainer
          hdType="keystone"
          status={status}
          content={content}
        />,
      );
      expect(content.mock.calls[0][0]).toEqual({
        contentColor:
          status === 'RESOLVED' ? 'green-default' : 'neutral-title-1',
      });

      content.mockClear();
      view.rerender(
        <ApprovalPopupContainer
          hdType="keystone"
          status={status === 'RESOLVED' ? 'SENDING' : 'RESOLVED'}
          content={content}
        />,
      );
      expect(content.mock.calls[0][0]).toEqual({
        contentColor:
          status === 'RESOLVED' ? 'neutral-title-1' : 'green-default',
      });
    },
  );

  it('does not offer a new scan while the received signature is submitting', () => {
    render(
      <ApprovalPopupContainer
        hdType="keystone"
        status="SENDING"
        content={() => <Text>Signed. Creating transaction...</Text>}
      />,
    );

    expect(screen.getByText('Signed. Creating transaction...')).toBeTruthy();
    expect(screen.queryByText('Retry')).toBeNull();
  });

  it('preserves a retry while still waiting for the signature', () => {
    const onRetry = jest.fn();
    render(
      <ApprovalPopupContainer
        hdType="keystone"
        status="WAITING"
        content={() => <Text>Waiting for signature</Text>}
        onRetry={onRetry}
      />,
    );

    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it.each(['FAILED', 'REJECTED'] as const)(
    'keeps the explicit retry after QR signing is %s',
    status => {
      const onRetry = jest.fn();
      render(
        <ApprovalPopupContainer
          hdType="keystone"
          status={status}
          content={() => <Text>Signing failed</Text>}
          onRetry={onRetry}
        />,
      );

      fireEvent.press(screen.getByText('Retry after failure'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    'wired',
    'wireless',
    'qrcode',
    'privatekey',
    'walletconnect',
    'ble',
    'onekey',
    'ledger',
    'trezor',
  ] as const)('preserves the existing %s sending retry', hdType => {
    const onRetry = jest.fn();
    render(
      <ApprovalPopupContainer
        hdType={hdType}
        status="SENDING"
        content={() => <Text>Sending</Text>}
        onRetry={onRetry}
      />,
    );

    fireEvent.press(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
