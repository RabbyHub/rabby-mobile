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

// Component structure only: actual Fabric layout/scroll-indicator behavior is
// checked on the Android and iOS validation packages.
describe.each([
  ['regular', ApprovalPopupContainer],
  ['mini', MiniApprovalPopupContainer],
] as const)('%s approval popup', (_name, Container) => {
  it.each([undefined, ''])(
    'uses a plain spacer without a description (%s)',
    description => {
      render(
        <Container
          hdType="privatekey"
          status="SUBMITTING"
          content={() => <Text>Ready to sign</Text>}
          description={description}
        />,
      );
      expect(screen.getByText('Ready to sign')).toBeTruthy();
      expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    },
  );

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
