import React from 'react';
import { act, render } from '@testing-library/react-native';

const mockApiLedger = {
  isConnected: jest.fn(),
  connectDevice: jest.fn(),
  fixDeviceId: jest.fn(),
};
const mockCreateGlobalBottomSheetModal = jest.fn();
let mockProcessActionProps: Record<string, unknown> | undefined;

jest.mock('@/core/apis', () => ({
  apiLedger: mockApiLedger,
}));

jest.mock('@/components2024/GlobalBottomSheetModal', () => ({
  createGlobalBottomSheetModal2024: mockCreateGlobalBottomSheetModal,
  removeGlobalBottomSheetModal2024: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./ProcessActions', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return {
    ProcessActions: (props: Record<string, unknown>) => {
      mockProcessActionProps = props;
      return <Pressable testID="ledger-process-actions" />;
    },
  };
});

describe('LedgerProcessActions navigation races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcessActionProps = undefined;
    mockApiLedger.connectDevice.mockResolvedValue(undefined);
    mockApiLedger.fixDeviceId.mockResolvedValue(undefined);
  });

  it('leaves Ledger readiness probing to the sign click', async () => {
    const { LedgerProcessActions } =
      require('./LedgerProcessActions') as typeof import('./LedgerProcessActions');
    mockApiLedger.isConnected.mockResolvedValue([true, 'ledger-device-id']);

    render(
      <LedgerProcessActions
        {...({
          account: {
            address: '0x0000000000000000000000000000000000000001',
            type: 'Ledger Hardware',
            brandName: 'Ledger',
          },
          disabledProcess: false,
          onSubmit: jest.fn(),
        } as never)}
      />,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockApiLedger.isConnected).not.toHaveBeenCalled();
  });

  it('uses one readiness probe for simultaneous sign clicks', async () => {
    const { LedgerProcessActions } =
      require('./LedgerProcessActions') as typeof import('./LedgerProcessActions');
    const onSubmit = jest.fn();
    mockApiLedger.isConnected.mockResolvedValue([true, 'ledger-device-id']);

    render(
      <LedgerProcessActions
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

    await act(async () => {
      const submit = mockProcessActionProps?.onSubmit as
        | (() => Promise<void>)
        | undefined;
      await Promise.all([submit?.(), submit?.()]);
    });

    expect(mockApiLedger.isConnected).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(mockCreateGlobalBottomSheetModal).not.toHaveBeenCalled();
  });

  it('opens ConnectLedger when the click-time probe is disconnected', async () => {
    const { LedgerProcessActions } =
      require('./LedgerProcessActions') as typeof import('./LedgerProcessActions');
    const onSubmit = jest.fn();
    mockApiLedger.isConnected.mockResolvedValue([false, 'ledger-device-id']);

    render(
      <LedgerProcessActions
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

    await act(async () => {
      await (
        mockProcessActionProps?.onSubmit as (() => Promise<void>) | undefined
      )?.();
    });

    expect(mockApiLedger.isConnected).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledTimes(1);
  });

  it('keeps the submit locked when a successful connection modal dismisses', async () => {
    const { LedgerProcessActions } =
      require('./LedgerProcessActions') as typeof import('./LedgerProcessActions');
    let finishSigning: (() => void) | undefined;
    const onSubmit = jest.fn(
      () =>
        new Promise<void>(resolve => {
          finishSigning = resolve;
        }),
    );
    mockApiLedger.isConnected.mockResolvedValue([false, 'ledger-device-id']);

    render(
      <LedgerProcessActions
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

    await act(async () => {
      await (
        mockProcessActionProps?.onSubmit as (() => Promise<void>) | undefined
      )?.();
    });

    const modal = mockCreateGlobalBottomSheetModal.mock.calls[0]?.[0];
    await act(async () => {
      await modal?.onSelectDevice?.({ id: 'ledger-device-id' });
      modal?.bottomSheetModalProps?.onDismiss?.();
    });

    await act(async () => {
      await (
        mockProcessActionProps?.onSubmit as (() => Promise<void>) | undefined
      )?.();
    });

    expect(mockApiLedger.isConnected).toHaveBeenCalledTimes(1);
    expect(mockCreateGlobalBottomSheetModal).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishSigning?.();
    });
  });
});
