const mockSignTypedData = jest.fn();
const mockMatomoRequestEvent = jest.fn();
const mockStatsReport = jest.fn();
const mockGetKRCategoryByType = jest.fn();
const mockEventBusEmit = jest.fn();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

jest.mock('@/core/apis/keyring', () => ({
  apisKeyring: {
    signTypedData: (...args: unknown[]) => mockSignTypedData(...args),
  },
}));

jest.mock('./analytics', () => ({
  matomoRequestEvent: (...args: unknown[]) => mockMatomoRequestEvent(...args),
}));

jest.mock('./stats', () => ({
  stats: {
    report: (...args: unknown[]) => mockStatsReport(...args),
  },
}));

jest.mock('./transaction', () => ({
  getKRCategoryByType: (...args: unknown[]) => mockGetKRCategoryByType(...args),
}));

jest.mock('@rabby-wallet/keyring-utils', () => ({
  eventBus: {
    emit: (...args: unknown[]) => mockEventBusEmit(...args),
  },
}));

jest.mock('./events', () => ({
  EVENTS: {
    COMMON_HARDWARE: {
      REJECTED: 'COMMON_HARDWARE.REJECTED',
    },
  },
}));

import { FailedCode, sendSignTypedData } from './sendTypedData';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'SimpleKeyring',
  brandName: 'Rabby',
} as any;

const typedData = {
  domain: {
    name: 'Rabby Test',
  },
  message: {
    value: 'hello',
  },
};

describe('sendSignTypedData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKRCategoryByType.mockReturnValue('private-key');
    mockStatsReport.mockResolvedValue(undefined);
  });

  afterAll(() => {
    mockConsoleError.mockRestore();
  });

  it('requires an account before building typed-data signing', async () => {
    await expect(
      sendSignTypedData({
        data: typedData,
        from: account.address,
        version: 'V4',
      }),
    ).rejects.toThrow('Account is required for signing typed data');
    expect(mockSignTypedData).not.toHaveBeenCalled();
  });

  it('signs V4 typed data with the derived method and returns the signature', async () => {
    const onProgress = jest.fn();
    mockSignTypedData.mockResolvedValue('0xtyped');

    await expect(
      sendSignTypedData({
        data: typedData,
        from: account.address,
        version: 'V4',
        onProgress,
        account,
      }),
    ).resolves.toEqual({ txHash: '0xtyped' });

    expect(onProgress.mock.calls).toEqual([
      ['building'],
      ['builded'],
      ['signed', '0xtyped'],
    ]);
    expect(mockSignTypedData).toHaveBeenCalledWith(
      account.type,
      account.address,
      typedData,
      {
        brandName: account.brandName,
        signTextMethod: 'ethSignTypedDataV4',
        version: 'V4',
      },
    );
    expect(mockStatsReport).toHaveBeenCalledWith(
      'startSignText',
      expect.objectContaining({
        type: 'Rabby',
        category: 'private-key',
        method: 'ethSignTypedDataV4',
      }),
    );
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'SignText',
        action: 'completeSignText',
        label: 'private-key|Rabby',
      }),
    );
  });

  it('uses the legacy method name for V1 typed data', async () => {
    mockSignTypedData.mockResolvedValue('0xv1');

    await sendSignTypedData({
      data: typedData,
      from: account.address,
      version: 'V1',
      account,
    });

    expect(mockSignTypedData).toHaveBeenCalledWith(
      account.type,
      account.address,
      typedData,
      expect.objectContaining({
        signTextMethod: 'ethSignTypedData',
        version: 'V1',
      }),
    );
  });

  it('emits hardware rejection and throws a named submit error on failure', async () => {
    mockSignTypedData.mockRejectedValue(new Error('ledger rejected'));

    await expect(
      sendSignTypedData({
        data: typedData,
        from: account.address,
        version: 'V3',
        account,
      }),
    ).rejects.toMatchObject({
      name: FailedCode.SubmitTxFailed,
      message: 'ledger rejected',
    });

    expect(mockEventBusEmit).toHaveBeenCalledWith(
      'COMMON_HARDWARE.REJECTED',
      'ledger rejected',
    );
    expect(mockStatsReport).toHaveBeenCalledWith(
      'completeSignText',
      expect.objectContaining({ method: 'ethSignTypedDataV3' }),
    );
  });
});
