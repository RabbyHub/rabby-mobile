import React from 'react';
import { render, screen } from '@testing-library/react-native';

jest.mock('@/components2024/Toast', () => ({ toast: {} }));
jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({
    styles: { content: {}, contentWrapper: {} },
    colors2024: { 'red-default': '#f00' },
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('ahooks', () => ({ useMemoizedFn: (fn: unknown) => fn }));
jest.mock('@/utils/errorTxRetry', () => ({
  getTxFailedResult: jest.fn(() => ['', 'origin']),
  setRetryTxType: jest.fn(),
}));
jest.mock('@/assets/icons/wallet/ledger.svg', () => () => null);
jest.mock('@/components/Typography', () => ({
  Text: require('react-native').Text,
}));
jest.mock('../Popup/MiniApprovalPopupContainer', () => ({
  MiniApprovalPopupContainer: ({ description }: { description: string }) => {
    const { Text } = require('react-native');
    return <Text>{description}</Text>;
  },
}));

const { MiniLedgerHardwareWaiting } =
  require('./MiniLedgerHardwareWaiting') as typeof import('./MiniLedgerHardwareWaiting');

describe('MiniLedgerHardwareWaiting', () => {
  it('shows the friendly rejection message for the DMK 0x5501 status', () => {
    render(
      <MiniLedgerHardwareWaiting
        error={{
          status: 'REJECTED',
          content: 'Rejected',
          description: 'Ledger error 0x5501',
        }}
      />,
    );

    expect(
      screen.getByText('page.signFooterBar.ledger.txRejectedByLedger'),
    ).toBeTruthy();
  });
});
