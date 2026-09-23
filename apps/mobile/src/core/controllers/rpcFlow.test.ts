const mockCaptureException = jest.fn();
const mockAutoConnect = jest.fn();
const mockFindChain = jest.fn();
const mockRequestApproval = jest.fn();
const mockEthSendTransaction = jest.fn();
const mockEthSignTypedData = jest.fn();
const mockValidateTypedData = jest.fn();
const mockWalletSwitchEthereumChain = jest.fn();
const mockGetDapp = jest.fn();
const mockGetConnectedDapp = jest.fn();
const mockUpdateDapp = jest.fn();
const mockGetStatsData = jest.fn();
const mockSetStatsData = jest.fn();
const mockSetCurrentRequestDeferFn = jest.fn();
const mockUnLock = jest.fn();
const mockEnsureNotificationServiceReady = jest.fn();
const mockEnsureDappServiceReady = jest.fn();
const mockSyncCustomTestnetChainList = jest.fn();
const mockGetCustomTestnetList = jest.fn();
const mockGetTestnetChainList = jest.fn();

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
  getTestnetChainList: (...args: unknown[]) => mockGetTestnetChainList(...args),
}));

jest.mock('@/core/serviceApi/autoConnect', () => ({
  autoConnectServiceApi: {
    autoConnect: (...args: unknown[]) => mockAutoConnect(...args),
  },
}));

jest.mock('@/core/serviceApi/dapp', () => ({
  ensureDappServiceReady: (...args: unknown[]) =>
    mockEnsureDappServiceReady(...args),
  getConnectedDappSnapshot: (...args: unknown[]) =>
    mockGetConnectedDapp(...args),
  getDappSnapshot: (...args: unknown[]) => mockGetDapp(...args),
  hasDappPermissionSnapshot: jest.fn(() => true),
  updateDappSync: (...args: unknown[]) => mockUpdateDapp(...args),
}));

jest.mock('@/core/serviceApi/notification', () => ({
  ensureNotificationServiceReady: (...args: unknown[]) =>
    mockEnsureNotificationServiceReady(...args),
  getNotificationStatsDataSnapshot: (...args: unknown[]) =>
    mockGetStatsData(...args),
  notificationServiceApi: {
    requestApproval: (...args: unknown[]) => mockRequestApproval(...args),
  },
  setCurrentRequestDeferFnSync: (...args: unknown[]) =>
    mockSetCurrentRequestDeferFn(...args),
  setNotificationStatsDataSync: (...args: unknown[]) =>
    mockSetStatsData(...args),
  unlockNotificationSync: (...args: unknown[]) => mockUnLock(...args),
}));

jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: jest.fn(),
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

jest.mock('@/core/serviceApi/customTestnet', () => ({
  customTestnetServiceApi: {
    syncChainList: (...args: unknown[]) =>
      mockSyncCustomTestnetChainList(...args),
    getList: (...args: unknown[]) => mockGetCustomTestnetList(...args),
  },
}));

jest.mock('./provider', () => ({
  __esModule: true,
  default: {
    ethSendTransaction: (...args: unknown[]) => mockEthSendTransaction(...args),
    ethSignTypedData: (...args: unknown[]) => mockEthSignTypedData(...args),
    ethSignTypedDataV1: (...args: unknown[]) => mockEthSignTypedData(...args),
    ethSignTypedDataV3: (...args: unknown[]) => mockEthSignTypedData(...args),
    ethSignTypedDataV4: (...args: unknown[]) => mockEthSignTypedData(...args),
    walletSwitchEthereumChain: (...args: unknown[]) =>
      mockWalletSwitchEthereumChain(...args),
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
import type { ProviderRequest } from './type';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant/internalRequest';

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
    mockAutoConnect.mockResolvedValue(undefined);
    mockFindChain.mockReturnValue(null);
    mockGetCustomTestnetList.mockReturnValue([]);
    mockGetTestnetChainList.mockReturnValue([]);
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
    expect(mockEnsureDappServiceReady).toHaveBeenCalledTimes(1);
    expect(mockEnsureNotificationServiceReady).toHaveBeenCalledTimes(1);
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

  it('syncs custom testnet chains before SignTx chain validation', async () => {
    const customChain = {
      enum: 'CUSTOM_9001',
      id: 9001,
      serverId: 'custom_9001',
    };
    mockGetCustomTestnetList.mockReturnValue([customChain]);
    mockGetConnectedDapp.mockReturnValue({
      chainId: 'CUSTOM_9001',
    });
    mockFindChain.mockImplementation(({ enum: chainEnum, id }: any) => {
      if (
        mockSyncCustomTestnetChainList.mock.calls.length &&
        (id === 9001 || chainEnum === 'CUSTOM_9001')
      ) {
        return customChain;
      }
      return null;
    });
    mockRequestApproval.mockResolvedValue({
      chainId: 9001,
    });
    mockEthSendTransaction.mockResolvedValue('0xhash');

    await expect(
      rpcFlow({
        data: {
          method: 'eth_sendTransaction',
          params: [
            {
              from: account.address,
              to: '0x2222222222222222222222222222222222222222',
            },
          ],
        },
        session: {
          origin: 'https://custom.example',
          name: 'Custom Dapp',
          icon: '',
        },
        account,
      } as any),
    ).resolves.toBe('0xhash');

    expect(mockSyncCustomTestnetChainList).toHaveBeenCalled();
    expect(mockRequestApproval).toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('does not resync custom testnet chains when chain store is already warm', async () => {
    const customChain = {
      enum: 'CUSTOM_9001',
      id: 9001,
      serverId: 'custom_9001',
    };
    mockGetCustomTestnetList.mockReturnValue([customChain]);
    mockGetTestnetChainList.mockReturnValue([customChain]);
    mockGetConnectedDapp.mockReturnValue({
      chainId: 'CUSTOM_9001',
    });
    mockFindChain.mockImplementation(({ enum: chainEnum, id }: any) => {
      if (id === 9001 || chainEnum === 'CUSTOM_9001') {
        return customChain;
      }
      return null;
    });
    mockRequestApproval.mockResolvedValue({
      chainId: 9001,
    });
    mockEthSendTransaction.mockResolvedValue('0xhash');

    await expect(
      rpcFlow({
        data: {
          method: 'eth_sendTransaction',
          params: [
            {
              from: account.address,
              to: '0x2222222222222222222222222222222222222222',
            },
          ],
        },
        session: {
          origin: 'https://custom.example',
          name: 'Custom Dapp',
          icon: '',
        },
        account,
      } as any),
    ).resolves.toBe('0xhash');

    expect(mockSyncCustomTestnetChainList).not.toHaveBeenCalled();
    expect(mockRequestApproval).toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });
});

describe('rpcFlow typed-data chain pinning', () => {
  let originalGetMetadata: unknown;
  const makeRequest = (
    method = 'eth_signTypedData_v4',
    domainChainId?: number,
  ): ProviderRequest => ({
    data: {
      method,
      params: /^eth_signTypedData(_v1)?$/.test(method)
        ? [
            [{ name: 'message', type: 'string', value: 'test' }],
            account.address,
          ]
        : [
            account.address,
            JSON.stringify({ domain: { chainId: domainChainId }, message: {} }),
          ],
    },
    session: { origin: 'https://example.com', name: 'Example', icon: '' },
    account,
  });

  beforeAll(() => {
    originalGetMetadata = (Reflect as any).getMetadata;
    (Reflect as any).getMetadata = jest.fn((key, _target, propertyKey) => {
      if (key !== 'APPROVAL') return undefined;
      if (propertyKey.startsWith('ethSignTypedData')) {
        return ['SignTypedData', mockValidateTypedData];
      }
      if (propertyKey === 'walletSwitchEthereumChain') {
        return ['SwitchChain', () => true];
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
    mockGetCustomTestnetList.mockReturnValue([]);
    mockGetTestnetChainList.mockReturnValue([]);
    mockGetDapp.mockReturnValue(undefined);
    mockGetConnectedDapp.mockReturnValue({ chainId: 'eth' });
    mockFindChain.mockImplementation(({ enum: chainEnum }) =>
      chainEnum === 'eth' ? { id: 1, enum: 'eth' } : null,
    );
    mockValidateTypedData.mockReturnValue(undefined);
    mockRequestApproval.mockResolvedValue({});
    mockEthSignTypedData.mockResolvedValue('0xsignature');
    mockWalletSwitchEthereumChain.mockResolvedValue(null);
  });

  it.each<[string, number | undefined]>([
    ['eth_signTypedData', undefined],
    ['eth_signTypedData_v1', undefined],
    ['eth_signTypedData_v3', 1],
    ['eth_signTypedData_v4', 1],
    ['eth_signTypedData_v3', undefined],
    ['eth_signTypedData_v4', undefined],
  ])(
    'pins %s with domain chain %s before validation and approval',
    async (method, chainId) => {
      mockValidateTypedData.mockImplementation(request => {
        expect(request.requestContext.chainId).toBe(1);
      });
      const approvalOpened = new Promise<() => void>(resolve => {
        mockRequestApproval.mockImplementation(
          () => new Promise(approve => resolve(() => approve({}))),
        );
      });
      const signing = rpcFlow(makeRequest(method, chainId));
      const approve = await Promise.race([
        approvalOpened,
        signing.then(() => {
          throw new Error('Signing completed before approval');
        }),
      ]);

      expect(mockValidateTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({ chainId: 1 }),
        }),
      );
      const approval = mockRequestApproval.mock.calls[0][0];
      expect(approval.params.requestContext.chainId).toBe(1);

      mockGetConnectedDapp.mockReturnValue({ chainId: 'bsc' });
      expect(approval.params.requestContext.chainId).toBe(1);
      approve();

      await expect(signing).resolves.toBe('0xsignature');
      expect(mockEthSignTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: expect.objectContaining({ chainId: 1 }),
        }),
      );
    },
  );

  it.each<['walletconnect' | 'internal', number | undefined]>([
    ['walletconnect', 56],
    ['internal', undefined],
    ['internal', 137],
  ])('preserves the %s request chain %s', async (source, chainId) => {
    const request = makeRequest();
    if (source === 'walletconnect') {
      request.requestContext = {
        source,
        origin: request.session.origin,
        chainId,
      };
    } else {
      request.session.origin = INTERNAL_REQUEST_ORIGIN;
      request.data.$ctx = { chainId };
    }

    await expect(rpcFlow(request)).resolves.toBe('0xsignature');
    expect(
      mockRequestApproval.mock.calls[0][0].params.requestContext,
    ).toMatchObject({
      source,
      chainId,
    });
    expect(mockGetConnectedDapp).not.toHaveBeenCalled();
  });

  it('rejects an unknown dapp chain before validation or approval', async () => {
    mockGetConnectedDapp.mockReturnValue({ chainId: 'unknown' });

    await expect(rpcFlow(makeRequest())).rejects.toMatchObject({
      code: -32602,
      message: 'Unsupported chainId for typed data',
    });
    expect(mockValidateTypedData).not.toHaveBeenCalled();
    expect(mockRequestApproval).not.toHaveBeenCalled();
    expect(mockEthSignTypedData).not.toHaveBeenCalled();
  });

  it('does not pin or open an approval for a promptless chain switch', async () => {
    const request = makeRequest();
    request.data = {
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x38' }],
    };

    await expect(rpcFlow(request)).resolves.toBeNull();
    expect(
      mockWalletSwitchEthereumChain.mock.calls[0][0].requestContext.chainId,
    ).toBeUndefined();
    expect(mockGetConnectedDapp).not.toHaveBeenCalled();
    expect(mockRequestApproval).not.toHaveBeenCalled();
  });
});
