import type { Account } from '@/core/startupServices/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

const mockSignTypedData = jest.fn();
const mockSendRequest = jest.fn();
const mockMiniSignTypedData = jest.fn();

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_SESSION: { name: 'internal-session' },
}));
jest.mock('@/core/apis/keyring', () => ({
  apisKeyring: {
    signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
  },
}));
jest.mock('@/core/apis/sendRequest', () => ({
  sendRequest: (...args: unknown[]) => mockSendRequest(...args),
}));
jest.mock('@/hooks/useMiniSignTypedData', () => ({
  miniSignTypedData: (...args: unknown[]) => mockMiniSignTypedData(...args),
}));

import { signPerpsMasterTypedData } from './signPerpsMasterTypedData';

const action = { message: { type: 'send' }, nonce: 7 };
const account = (type: string) =>
  ({
    address: '0xAbC',
    brandName: 'Rabby',
    type,
  } as Account);

describe('signPerpsMasterTypedData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([KEYRING_CLASS.PRIVATE_KEY, KEYRING_CLASS.MNEMONIC])(
    'uses keyring V4 signing for %s',
    async type => {
      mockSignTypedData.mockResolvedValue('0xlocal');
      await expect(
        signPerpsMasterTypedData({
          account: account(type),
          action,
          miniSignError: new Error('failed'),
        }),
      ).resolves.toBe('0xlocal');
      expect(mockSignTypedData).toHaveBeenCalledWith(type, '0xabc', action, {
        version: 'V4',
      });
    },
  );

  it.each([KEYRING_CLASS.HARDWARE.ONEKEY, KEYRING_CLASS.HARDWARE.LEDGER])(
    'uses the existing mini V4 signing behavior for %s',
    async type => {
      mockMiniSignTypedData.mockResolvedValue([{ txHash: '0xhardware' }]);
      await expect(
        signPerpsMasterTypedData({
          account: account(type),
          action,
          miniSignError: new Error('failed'),
        }),
      ).resolves.toBe('0xhardware');
      expect(mockMiniSignTypedData).toHaveBeenCalledWith({
        account: account(type),
        txs: [{ data: action, from: '0xAbC', version: 'V4' }],
      });

      mockMiniSignTypedData.mockResolvedValueOnce([]);
      await expect(
        signPerpsMasterTypedData({
          account: account(type),
          action,
          miniSignError: new Error('failed'),
        }),
      ).rejects.toThrow('failed');

      mockMiniSignTypedData.mockResolvedValueOnce([{ txHash: '' }]);
      await expect(
        signPerpsMasterTypedData({
          account: account(type),
          action,
          miniSignError: new Error('failed'),
        }),
      ).resolves.toBe('');
    },
  );

  it('uses the existing internal request session for external accounts', async () => {
    mockSendRequest.mockResolvedValue('0xexternal');
    await expect(
      signPerpsMasterTypedData({
        account: account(KEYRING_CLASS.WATCH),
        action,
        miniSignError: new Error('failed'),
      }),
    ).resolves.toBe('0xexternal');
    expect(mockSendRequest).toHaveBeenCalledWith({
      account: account(KEYRING_CLASS.WATCH),
      data: {
        method: 'eth_signTypedDataV4',
        params: ['0xAbC', JSON.stringify(action)],
      },
      session: { name: 'internal-session' },
    });
  });

  it('preserves raw mini-sign failures when the caller does not request legacy mapping', async () => {
    const failure = new Error('Hardware disconnected');
    mockMiniSignTypedData.mockRejectedValue(failure);

    await expect(
      signPerpsMasterTypedData({
        account: account(KEYRING_CLASS.HARDWARE.LEDGER),
        action,
      }),
    ).rejects.toBe(failure);
  });
});
