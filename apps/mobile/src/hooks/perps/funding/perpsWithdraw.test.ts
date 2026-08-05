import type { Account } from '@/core/startupServices/preference';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';

const mockPrepareSendAsset = jest.fn();
const mockPrepareWithdraw = jest.fn();
const mockSendSendAsset = jest.fn();
const mockSendWithdraw = jest.fn();
const mockSignTypedData = jest.fn();
const mockSendRequest = jest.fn();
const mockMiniSignTypedData = jest.fn();
const mockShowToast = jest.fn();

jest.mock('@/constant', () => ({ INTERNAL_REQUEST_SESSION: {} }));

jest.mock('@/core/apis/perps', () => ({
  apisPerps: {
    getPerpsSDK: () => ({
      exchange: {
        prepareSendAsset: mockPrepareSendAsset,
        prepareWithdraw: mockPrepareWithdraw,
        sendSendAsset: mockSendSendAsset,
        sendWithdraw: mockSendWithdraw,
      },
    }),
  },
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
jest.mock('../showToast', () => ({
  __esModule: true,
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

import { executePerpsWithdraw } from './perpsWithdraw';

const account = {
  address: '0xAbC',
  brandName: 'Rabby',
  type: KEYRING_CLASS.PRIVATE_KEY,
} as Account;

describe('executePerpsWithdraw', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockPrepareWithdraw.mockReturnValue({
      message: { type: 'withdraw' },
      nonce: 7,
    });
    mockPrepareSendAsset.mockReturnValue({
      message: { type: 'send' },
      nonce: 8,
    });
    mockSignTypedData.mockResolvedValue('0xsigned');
    mockSendWithdraw.mockResolvedValue({ hash: '0xwithdraw' });
    mockSendSendAsset.mockResolvedValue({ hash: '0xsend' });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('keeps the legacy withdraw signing and pending-history semantics', async () => {
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '12',
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(true);

    expect(mockPrepareWithdraw).toHaveBeenCalledWith({
      amount: '12',
      destination: account.address,
    });
    expect(mockSignTypedData).toHaveBeenCalledWith(
      account.type,
      account.address.toLowerCase(),
      expect.objectContaining({ nonce: 7 }),
      { version: 'V4' },
    );
    expect(mockSendWithdraw).toHaveBeenCalledWith({
      action: { type: 'withdraw' },
      nonce: 7,
      signature: '0xsigned',
    });
    expect(setLocalLoadingHistory).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          hash: '0xwithdraw',
          status: 'pending',
          type: 'withdraw',
          usdValue: '11',
        }),
      ],
      false,
    );
  });

  it('routes HYPE sends from Spot for Unified and Portfolio Margin callers', async () => {
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '3',
        isHypeWithdraw: true,
        isSpotCollateralMode: true,
        setLocalLoadingHistory,
        targetAsset: 'USDT',
      }),
    ).resolves.toBe(true);

    expect(mockPrepareSendAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '3',
        destinationDex: 'spot',
        sourceDex: 'spot',
      }),
    );
    expect(mockSendSendAsset).toHaveBeenCalledWith({
      action: { type: 'send' },
      nonce: 8,
      signature: '0xsigned',
    });
    expect(setLocalLoadingHistory).toHaveBeenCalledWith(
      [expect.objectContaining({ hash: '0xsend', usdValue: '3' })],
      false,
    );
  });

  it('does not write a completed action into a newly selected account', async () => {
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '12',
        isAccountCurrent: () => false,
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(true);

    expect(mockSendWithdraw).toHaveBeenCalledTimes(1);
    expect(setLocalLoadingHistory).not.toHaveBeenCalled();
  });

  it('fails closed without signing when the target asset is invalid', async () => {
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '1',
        setLocalLoadingHistory,
        targetAsset: 'BTC' as never,
      }),
    ).resolves.toBe(false);

    expect(mockSignTypedData).not.toHaveBeenCalled();
    expect(setLocalLoadingHistory).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      'Invalid target asset, targetAsset: BTC',
      'error',
    );
  });
});
