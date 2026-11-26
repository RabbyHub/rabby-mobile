const mockSend = jest.fn();
const mockIsConnected = jest.fn();
const mockCancel = jest.fn(async () => undefined);

jest.mock('@/utils/sendTypedData', () => ({
  sendSignTypedData: (...args: unknown[]) => mockSend(...args),
}));
jest.mock('@/core/apis', () => ({
  apiOneKey: {
    isConnected: (...args: unknown[]) => mockIsConnected(...args),
    cancel: (...args: unknown[]) => mockCancel(...args),
  },
  apiLedger: {
    isConnected: jest.fn(),
  },
}));
jest.mock('@/utils/walletUnlock', () => ({
  ensureWalletUnlockedForAction: async () => true,
}));
jest.mock('@/hooks/onekey/useOneKeyStatus', () => ({
  callConnectOneKeyModal: jest.fn(),
  setOneKeyStatus: jest.fn(),
}));
jest.mock('@/hooks/ledger/useLedgerStatus', () => ({
  callConnectLedgerModal: jest.fn(),
  setLedgerStatus: jest.fn(),
}));
jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import {
  cancelMiniSignTypedData,
  getMiniSignTypedDataState,
  miniSignTypedData,
} from './useMiniSignTypedData';

const account = {
  type: KEYRING_CLASS.HARDWARE.ONEKEY,
  address: '0x1111111111111111111111111111111111111111',
} as any;

const typedData = (id: number) =>
  ({
    data: { id },
    from: account.address,
    version: 'V4',
  } as any);

async function waitFor(ready: () => boolean) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (ready()) {
      return;
    }
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('timed out waiting for typed-data signing');
}

describe('miniSignTypedData cancellation', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockIsConnected.mockReset();
    mockCancel.mockReset();
    mockCancel.mockResolvedValue(undefined);
    cancelMiniSignTypedData();
    mockCancel.mockClear();
  });

  it('signs when the sheet stays open', async () => {
    mockIsConnected.mockResolvedValue([true, 'connect-id']);
    mockSend.mockResolvedValue({ txHash: '0xabc' });

    await expect(
      miniSignTypedData({
        txs: [typedData(1)],
        account,
      }),
    ).resolves.toEqual([{ txHash: '0xabc' }]);

    expect(mockSend).toHaveBeenCalledTimes(1);
    cancelMiniSignTypedData();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('does not sign after the sheet closes during hardware connect', async () => {
    let resolveConnected: (value: [boolean, string?]) => void = () => undefined;
    mockIsConnected.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveConnected = resolve;
        }),
    );

    const pending = miniSignTypedData({
      txs: [typedData(1)],
      account,
    });
    const closeDuringConnect = (async () => {
      await waitFor(() => mockIsConnected.mock.calls.length > 0);
      cancelMiniSignTypedData();
      resolveConnected([true, 'connect-id']);
      await new Promise(resolve => setImmediate(resolve));
    })();

    await expect(pending).rejects.toThrow('User cancelled hardware connection');
    await closeDuringConnect;

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(getMiniSignTypedDataState().status).toBe('pending');
  });

  it('does not publish or continue after the sheet closes during a signature', async () => {
    mockIsConnected.mockResolvedValue([true, 'connect-id']);
    let releaseSend: (value: unknown) => void = () => undefined;
    mockSend.mockImplementation(
      () =>
        new Promise(resolve => {
          releaseSend = resolve;
        }),
    );

    const pending = miniSignTypedData({
      txs: [typedData(1), typedData(2)],
      account,
    });
    const closeDuringSign = (async () => {
      await waitFor(() => mockSend.mock.calls.length === 1);
      cancelMiniSignTypedData();
      releaseSend({ txHash: '0x1' });
      await new Promise(resolve => setImmediate(resolve));
    })();

    await expect(pending).rejects.toThrow('User cancelled hardware connection');
    await closeDuringSign;

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(getMiniSignTypedDataState().status).toBe('pending');
  });
});
