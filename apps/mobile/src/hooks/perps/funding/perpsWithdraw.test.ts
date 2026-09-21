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
const mockUpsertFundingJournal = jest.fn(async () => undefined);

jest.mock('@/constant', () => ({ INTERNAL_REQUEST_SESSION: {} }));

jest.mock('@/core/serviceApi/perps', () => ({
  perpsServiceApi: {
    upsertPerpsFundingJournalEntry: (...args: unknown[]) =>
      mockUpsertFundingJournal(...args),
  },
}));

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
      [
        expect.objectContaining({
          amount: '3',
          asset: 'USDT',
          hash: '0xsend',
          usdValue: '3',
        }),
      ],
      false,
    );
    expect(mockUpsertFundingJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '3',
        asset: 'USDT',
        settlementIdentity: { kind: 'hyperliquidNonce', nonce: 8 },
        sourceIdentity: {
          hash: '0xsend',
          kind: 'evmTransactionHash',
        },
        status: 'pending',
      }),
    );
  });

  it('uses the Pro live abstraction mode instead of the cached route', async () => {
    const setLocalLoadingHistory = jest.fn();
    const queryLiveUserAbstraction = jest
      .fn()
      .mockResolvedValue('unifiedAccount');

    await expect(
      executePerpsWithdraw({
        account,
        amount: '3',
        isHypeWithdraw: true,
        isSpotCollateralMode: false,
        queryLiveUserAbstraction,
        setLocalLoadingHistory,
        targetAsset: 'USDT',
      }),
    ).resolves.toBe(true);

    expect(queryLiveUserAbstraction).toHaveBeenCalledTimes(2);
    expect(mockPrepareSendAsset).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDex: 'spot' }),
    );
    expect(mockSendSendAsset).toHaveBeenCalledTimes(1);
  });

  it('fails closed before signing when the Pro live mode cannot be read', async () => {
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '3',
        isHypeWithdraw: true,
        queryLiveUserAbstraction: async () => {
          throw new Error('offline');
        },
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(false);

    expect(mockPrepareSendAsset).not.toHaveBeenCalled();
    expect(mockSignTypedData).not.toHaveBeenCalled();
    expect(mockSendSendAsset).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith('offline', 'error');
  });

  it('fails closed before send when the Pro live mode changes during signing', async () => {
    const setLocalLoadingHistory = jest.fn();
    const queryLiveUserAbstraction = jest
      .fn()
      .mockResolvedValueOnce('unifiedAccount')
      .mockResolvedValueOnce('default');

    await expect(
      executePerpsWithdraw({
        account,
        amount: '3',
        isHypeWithdraw: true,
        queryLiveUserAbstraction,
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(false);

    expect(mockPrepareSendAsset).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDex: 'spot' }),
    );
    expect(mockSignTypedData).toHaveBeenCalledTimes(1);
    expect(mockSendSendAsset).not.toHaveBeenCalled();
    expect(mockUpsertFundingJournal).not.toHaveBeenCalled();
    expect(setLocalLoadingHistory).not.toHaveBeenCalled();
  });

  it('fails closed before send when the Pro account context expires after signing', async () => {
    const setLocalLoadingHistory = jest.fn();
    const queryLiveUserAbstraction = jest
      .fn()
      .mockResolvedValueOnce('default')
      .mockResolvedValueOnce(null);

    await expect(
      executePerpsWithdraw({
        account,
        amount: '12',
        queryLiveUserAbstraction,
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(false);

    expect(mockSignTypedData).toHaveBeenCalledTimes(1);
    expect(mockSendWithdraw).not.toHaveBeenCalled();
    expect(setLocalLoadingHistory).not.toHaveBeenCalled();
  });

  it('uses the prepared nonce when standard withdraw returns no hash', async () => {
    mockSendWithdraw.mockResolvedValueOnce({});
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '12',
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(true);

    expect(setLocalLoadingHistory).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          hash: 'hl-nonce:7',
          settlementNonce: 7,
          status: 'pending',
          type: 'withdraw',
        }),
      ],
      false,
    );
    expect(mockUpsertFundingJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementIdentity: { kind: 'hyperliquidNonce', nonce: 7 },
        sourceIdentity: undefined,
        version: 2,
      }),
    );
  });

  it('uses the prepared sendAsset nonce when a HYPE send returns no hash', async () => {
    mockSendSendAsset.mockResolvedValueOnce({});
    const setLocalLoadingHistory = jest.fn();

    await expect(
      executePerpsWithdraw({
        account,
        amount: '3',
        isHypeWithdraw: true,
        setLocalLoadingHistory,
      }),
    ).resolves.toBe(true);

    expect(setLocalLoadingHistory).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          hash: 'hl-nonce:8',
          settlementNonce: 8,
          status: 'pending',
          type: 'withdraw',
        }),
      ],
      false,
    );
    expect(mockUpsertFundingJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        settlementIdentity: { kind: 'hyperliquidNonce', nonce: 8 },
        sourceIdentity: undefined,
        version: 2,
      }),
    );
  });

  it('persists the operation before exposing its pending UI state', async () => {
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>(resolve => {
      markWriteStarted = resolve;
    });
    mockUpsertFundingJournal.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseWrite = resolve;
          markWriteStarted();
        }),
    );
    const setLocalLoadingHistory = jest.fn();

    const execution = executePerpsWithdraw({
      account,
      amount: '12',
      setLocalLoadingHistory,
    });
    await writeStarted;

    expect(setLocalLoadingHistory).not.toHaveBeenCalled();
    releaseWrite();
    await expect(execution).resolves.toBe(true);
    expect(setLocalLoadingHistory).toHaveBeenCalledTimes(1);
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
