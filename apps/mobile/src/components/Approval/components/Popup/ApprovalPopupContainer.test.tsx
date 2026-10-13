import React from 'react';
import { ScrollView, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
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
jest.mock('./FooterResend', () => ({ FooterResend: () => null }));
jest.mock('./FooterButton', () => ({ FooterButton: () => null }));
jest.mock('./FooterDoneButton', () => ({ FooterDoneButton: () => null }));
jest.mock('./FooterResendCancelGroup', () => ({
  FooterResendCancelGroup: () => null,
}));
jest.mock('./MiniFooterResendCancelGroup', () => ({
  MiniFooterResendCancelGroup: () => null,
}));
jest.mock('./Dots', () => ({ Dots: () => null }));
jest.mock('@/assets/icons/approval/tx-succeed.svg', () => () => null);
jest.mock('@/assets2024/icons/common/failed-retry.svg', () => () => null);

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
