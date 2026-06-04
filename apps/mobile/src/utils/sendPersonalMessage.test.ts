const mockEthPersonalSign = jest.fn();
const mockMatomoRequestEvent = jest.fn();
const mockStatsReport = jest.fn();
const mockGetKRCategoryByType = jest.fn();
const mockEventBusEmit = jest.fn();

jest.mock('@/core/apis/provider', () => ({
  ethPersonalSign: (...args: unknown[]) => mockEthPersonalSign(...args),
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_SESSION: { name: 'internal-session' },
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

jest.mock('./events', () => ({
  eventBus: {
    emit: (...args: unknown[]) => mockEventBusEmit(...args),
  },
  EVENTS: {
    COMMON_HARDWARE: {
      REJECTED: 'COMMON_HARDWARE.REJECTED',
    },
  },
}));

import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { FailedCode, sendPersonalMessage } from './sendPersonalMessage';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'SimpleKeyring',
  brandName: 'Rabby',
} as any;

describe('sendPersonalMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetKRCategoryByType.mockReturnValue('private-key');
    mockStatsReport.mockResolvedValue(undefined);
  });

  it('reports progress, signs with the internal session, and returns the signature', async () => {
    const onProgress = jest.fn();
    mockEthPersonalSign.mockResolvedValue('0xsigned');

    await expect(
      sendPersonalMessage({
        data: ['0x68656c6c6f', account.address],
        onProgress,
        account,
      }),
    ).resolves.toEqual({ txHash: '0xsigned' });

    expect(onProgress.mock.calls.map(call => call[0])).toEqual([
      'building',
      'builded',
      'signed',
    ]);
    expect(mockEthPersonalSign).toHaveBeenCalledWith({
      data: {
        params: ['0x68656c6c6f', account.address],
      },
      approvalRes: {
        extra: {
          brandName: account.brandName,
          signTextMethod: 'personalSign',
        },
      },
      session: INTERNAL_REQUEST_SESSION,
      account,
    });
    expect(mockMatomoRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'SignText',
        action: 'createSignText',
        label: 'private-key|Rabby',
      }),
    );
    expect(mockStatsReport).toHaveBeenCalledWith(
      'startSignText',
      expect.objectContaining({
        type: 'Rabby',
        category: 'private-key',
        method: 'personalSign',
      }),
    );
    expect(mockEventBusEmit).not.toHaveBeenCalled();
  });

  it('emits hardware rejection and throws a named submit error on signing failure', async () => {
    const onProgress = jest.fn();
    mockEthPersonalSign.mockRejectedValue(new Error('user rejected'));

    await expect(
      sendPersonalMessage({
        data: ['0x68656c6c6f', account.address],
        onProgress,
        account,
      }),
    ).rejects.toMatchObject({
      name: FailedCode.SubmitTxFailed,
      message: 'user rejected',
    });

    expect(onProgress.mock.calls.map(call => call[0])).toEqual([
      'building',
      'builded',
    ]);
    expect(mockEventBusEmit).toHaveBeenCalledWith(
      'COMMON_HARDWARE.REJECTED',
      'user rejected',
    );
    expect(mockStatsReport).toHaveBeenCalledWith(
      'completeSignText',
      expect.objectContaining({ method: 'personalSign' }),
    );
  });
});
