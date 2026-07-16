import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

const mockIsConnected = jest.fn();
const mockOnClickConnect = jest.fn();
let mockConnectSuccess: (() => void | Promise<void>) | undefined;
let mockMiniProcessActionProps: Record<string, unknown> | undefined;

jest.mock('@/core/apis', () => ({
  apiLedger: {
    isConnected: (...args: unknown[]) => mockIsConnected(...args),
  },
}));

jest.mock('@/hooks/ledger/useLedgerStatus', () => ({
  useLedgerStatus: () => ({
    onClickConnect: mockOnClickConnect,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/assets/icons/wallet/ledger.svg', () => () => null);

jest.mock('./MiniProcessActions', () => ({
  MiniProcessActions: (props: Record<string, unknown>) => {
    mockMiniProcessActionProps = props;
    return null;
  },
}));

const { MiniLedgerProcessActions } =
  require('./MiniLedgerProcessActions') as typeof import('./MiniLedgerProcessActions');

describe('MiniLedgerProcessActions connection races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectSuccess = undefined;
    mockMiniProcessActionProps = undefined;
    mockIsConnected.mockResolvedValue([false, 'ledger-device-id']);
    mockOnClickConnect.mockImplementation(success => {
      mockConnectSuccess = success;
    });
  });

  it('keeps the submit single-flight until the connection flow finishes', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <MiniLedgerProcessActions
        {...({
          account: {
            address: '0x0000000000000000000000000000000000000001',
            type: 'Ledger Hardware',
            brandName: 'Ledger',
          },
          disabledProcess: false,
          onSubmit,
        } as never)}
      />,
    );

    act(() => {
      const submit = mockMiniProcessActionProps?.onSubmit as
        | (() => void)
        | undefined;
      submit?.();
      submit?.();
    });

    await waitFor(() => {
      expect(mockOnClickConnect).toHaveBeenCalledTimes(1);
    });
    expect(mockMiniProcessActionProps?.loading).toBe(true);

    act(() => {
      (mockMiniProcessActionProps?.onSubmit as (() => void) | undefined)?.();
    });

    expect(mockIsConnected).toHaveBeenCalledTimes(1);
    expect(mockOnClickConnect).toHaveBeenCalledTimes(1);

    await act(async () => {
      await mockConnectSuccess?.();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mockMiniProcessActionProps?.loading).toBe(false);
  });
});
