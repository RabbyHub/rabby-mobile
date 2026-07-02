const mockCaptureException = jest.fn();
const mockFindChain = jest.fn();
const mockRequestApproval = jest.fn();
const mockEthSendTransaction = jest.fn();
const mockGetDapp = jest.fn();
const mockGetConnectedDapp = jest.fn();
const mockUpdateDapp = jest.fn();
const mockGetStatsData = jest.fn();
const mockSetStatsData = jest.fn();
const mockSetCurrentRequestDeferFn = jest.fn();
const mockUnLock = jest.fn();

jest.mock('@sentry/react-native', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
}));

jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {
    ETH: 'eth',
  },
}));

jest.mock('../services', () => ({
  autoConnectService: {
    autoConnect: jest.fn(),
  },
  dappService: {
    getDapp: (...args: unknown[]) => mockGetDapp(...args),
    updateDapp: (...args: unknown[]) => mockUpdateDapp(...args),
    hasPermission: jest.fn(() => true),
    getConnectedDapp: (...args: unknown[]) => mockGetConnectedDapp(...args),
  },
  keyringService: {},
  notificationService: {
    requestApproval: (...args: unknown[]) => mockRequestApproval(...args),
    getStatsData: (...args: unknown[]) => mockGetStatsData(...args),
    setStatsData: (...args: unknown[]) => mockSetStatsData(...args),
    setCurrentRequestDeferFn: (...args: unknown[]) =>
      mockSetCurrentRequestDeferFn(...args),
    unLock: (...args: unknown[]) => mockUnLock(...args),
  },
  preferenceService: {
    getFallbackAccount: jest.fn(),
  },
}));

jest.mock('./provider', () => ({
  __esModule: true,
  default: {
    ethSendTransaction: (...args: unknown[]) => mockEthSendTransaction(...args),
  },
}));

jest.mock('./autoConnect', () => ({
  shouldAutoConnect: jest.fn(() => false),
  shouldAutoPersonalSign: jest.fn(() => false),
}));

jest.mock('../apis/dapp', () => ({
  connect: jest.fn(),
}));

jest.mock('../apis/account', () => ({
  getAccountList: jest.fn(),
}));

jest.mock('@/core/utils/dappAccount', () => ({
  getDappAccount: jest.fn(),
}));

jest.mock('../request', () => ({
  openapi: {
    getRecommendChains: jest.fn(),
  },
}));

jest.mock('@/utils/events', () => ({
  eventBus: {
    emit: jest.fn(),
  },
  EVENTS: {
    SIGN_FINISHED: 'SIGN_FINISHED',
  },
}));

jest.mock('@/utils/stats', () => ({
  stats: {
    report: jest.fn(),
  },
}));

jest.mock('@/utils/number', () => ({
  intToHex: jest.fn(value => `0x${Number(value).toString(16)}`),
}));

jest.mock('../utils/signEvent', () => ({
  waitSignComponentAmounted: jest.fn(),
}));

jest.mock('./gnosisController', () => ({
  gnosisController: {
    watchMessage: jest.fn(),
  },
}));

jest.mock('@/utils/errorTxRetry', () => ({
  getRetryTxRecommendNonce: jest.fn(),
  getRetryTxType: jest.fn(),
}));

jest.mock('@/utils/walletUnlockGuard', () => ({
  ensureWalletUnlocked: jest.fn(),
}));

jest.mock('@/utils/walletUnlockError', () => ({
  isWalletUnlockCancelled: jest.fn(),
}));

import rpcFlow from './rpcFlow';

const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
};

describe('rpcFlow SignTx chain guard', () => {
  let originalGetMetadata: unknown;

  beforeAll(() => {
    originalGetMetadata = (Reflect as any).getMetadata;
    (Reflect as any).getMetadata = jest.fn((key, _target, propertyKey) => {
      if (key === 'APPROVAL' && propertyKey === 'ethSendTransaction') {
        return ['SignTx'];
      }
      return undefined;
    });
  });

  afterAll(() => {
    if (originalGetMetadata) {
      (Reflect as any).getMetadata = originalGetMetadata;
    } else {
      delete (Reflect as any).getMetadata;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindChain.mockReturnValue(null);
    mockGetDapp.mockReturnValue(undefined);
    mockGetConnectedDapp.mockReturnValue({
      chainId: 'eth',
    });
    mockGetStatsData.mockReturnValue(undefined);
  });

  it('rejects unsupported SignTx chain before opening approval', async () => {
    await expect(
      rpcFlow({
        data: {
          method: 'eth_sendTransaction',
          params: [
            {
              from: account.address,
              to: '0x2222222222222222222222222222222222222222',
              chainId: 999999,
            },
          ],
        },
        session: {
          origin: 'https://ethena.fi',
          name: 'Ethena',
          icon: '',
        },
        account,
      } as any),
    ).rejects.toMatchObject({
      code: -32602,
      message: 'Unsupported chainId for eth_sendTransaction',
    });

    expect(mockRequestApproval).not.toHaveBeenCalled();
    expect(mockEthSendTransaction).not.toHaveBeenCalled();
    expect(mockUnLock).not.toHaveBeenCalled();
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          scene: 'rpcFlow',
          approvalType: 'SignTx',
          method: 'eth_sendTransaction',
          source: 'dapp',
        }),
        extra: expect.objectContaining({
          origin: 'https://ethena.fi',
          rawChainId: 999999,
          normalizedChainId: 999999,
          connectedDappChainId: 'eth',
        }),
      }),
    );
  });
});
