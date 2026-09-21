import 'reflect-metadata';

import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';

const mockSubmitTxV2 = jest.fn();
const mockGetCustomTestnetClient = jest.fn();
const mockHasCustomRPC = jest.fn();
const mockGetDefaultRPC = jest.fn();
const mockProbeBestRPC = jest.fn();
const mockSignTransaction = jest.fn();
const mockGetKeyringForAccount = jest.fn();
const mockGetSigningTx = jest.fn();
const mockUpdateSigningTx = jest.fn();
const mockAddHistoryTx = jest.fn();
const mockRemoveSigningTx = jest.fn();
const mockWatcherAddTx = jest.fn();
const mockBroadcastWatcherAddTx = jest.fn();
const mockPostSwap = jest.fn();
const mockPostBridge = jest.fn();
const mockGetConnectedDappSnapshot = jest.fn();
const mockGetDappSnapshot = jest.fn();
const mockIsInternalDappSnapshot = jest.fn();
const mockFindChain = jest.fn();
const mockFindChainByEnum = jest.fn();

const ETH_CHAIN = {
  id: 1,
  enum: 'ETH',
  serverId: 'eth',
  isTestnet: false,
};
const BSC_CHAIN = {
  id: 56,
  enum: 'BSC',
  serverId: 'bsc',
  isTestnet: false,
};
// attacker-controlled custom testnet the dapp silently switches to mid-approval
const ATTACKER_CHAIN = {
  id: 31337,
  enum: 'CUSTOM_31337',
  serverId: 'custom_31337',
  isTestnet: true,
};
const KNOWN_CHAINS = [ETH_CHAIN, BSC_CHAIN, ATTACKER_CHAIN];

jest.mock('@/utils/chain', () => ({
  findChain: (...args: unknown[]) => mockFindChain(...args),
  findChainByEnum: (...args: unknown[]) => mockFindChainByEnum(...args),
}));

jest.mock('@/constant/chains', () => ({
  CHAINS_ENUM: {
    ETH: 'ETH',
    BSC: 'BSC',
  },
  getChainList: jest.fn(() => []),
  getMainnetChainList: jest.fn(() => []),
  getTestnetChainList: jest.fn(() => []),
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'rabby-internal-request',
  INTERNAL_REQUEST_SESSION: {
    name: 'Rabby',
    origin: 'rabby-internal-request',
    icon: '',
  },
}));

jest.mock('../request', () => ({
  openapi: {
    submitTxV2: (...args: unknown[]) => mockSubmitTxV2(...args),
  },
}));

jest.mock('@/core/serviceApi/dapp', () => ({
  getConnectedDappSnapshot: (...args: unknown[]) =>
    mockGetConnectedDappSnapshot(...args),
  getDappSnapshot: (...args: unknown[]) => mockGetDappSnapshot(...args),
  isInternalDappSnapshot: (...args: unknown[]) =>
    mockIsInternalDappSnapshot(...args),
  updateDappSync: jest.fn(),
  disconnectDappSync: jest.fn(),
}));

jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: {
    signTransaction: (...args: unknown[]) => mockSignTransaction(...args),
    signEip7702Authorization: jest.fn(),
    getKeyringForAccount: (...args: unknown[]) =>
      mockGetKeyringForAccount(...args),
    getAllVisibleAccountsArray: jest.fn(() => []),
  },
}));

jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: jest.fn(() => null),
  preferenceServiceApi: {
    setCurrentAccount: jest.fn(),
  },
}));

jest.mock('@/core/serviceApi/notification', () => ({
  getNotificationStatsDataSnapshot: jest.fn(() => undefined),
  setNotificationStatsDataSync: jest.fn(),
}));

jest.mock('@/core/serviceApi/session', () => ({
  broadcastSessionEventSync: jest.fn(),
}));

jest.mock('@/core/serviceApi/swap', () => ({
  swapServiceApi: {
    postSwap: (...args: unknown[]) => mockPostSwap(...args),
  },
}));

jest.mock('@/core/serviceApi/bridge', () => ({
  bridgeServiceApi: {
    postBridge: (...args: unknown[]) => mockPostBridge(...args),
  },
}));

jest.mock('@/core/serviceApi/customRPC', () => ({
  customRPCServiceApi: {
    hasCustomRPC: (...args: unknown[]) => mockHasCustomRPC(...args),
    getDefaultRPC: (...args: unknown[]) => mockGetDefaultRPC(...args),
    probeBestRPC: (...args: unknown[]) => mockProbeBestRPC(...args),
    requestCustomRPC: jest.fn(),
    defaultRPCSubmitTxWithFallback: jest.fn(),
    getDefaultRPCByChainServerId: jest.fn(),
  },
}));

jest.mock('@/core/serviceApi/customTestnet', () => ({
  customTestnetServiceApi: {
    getClient: (...args: unknown[]) => mockGetCustomTestnetClient(...args),
  },
}));

jest.mock('@/core/serviceApi/transactionHistory', () => ({
  transactionHistoryServiceApi: {
    getSigningTx: (...args: unknown[]) => mockGetSigningTx(...args),
    updateSigningTx: (...args: unknown[]) => mockUpdateSigningTx(...args),
    addTx: (...args: unknown[]) => mockAddHistoryTx(...args),
    removeSigningTx: (...args: unknown[]) => mockRemoveSigningTx(...args),
  },
}));

jest.mock('@/core/serviceApi/transactionWatcher', () => ({
  transactionWatcherServiceApi: {
    addTx: (...args: unknown[]) => mockWatcherAddTx(...args),
  },
}));

jest.mock('@/core/serviceApi/transactionBroadcastWatcher', () => ({
  transactionBroadcastWatcherServiceApi: {
    addTx: (...args: unknown[]) => mockBroadcastWatcherAddTx(...args),
  },
}));

jest.mock('@/utils/transaction', () => {
  const { isHexString } = require('ethereumjs-util');
  return {
    is1559Tx: (tx: any) => {
      if (!('maxFeePerGas' in tx) || !('maxPriorityFeePerGas' in tx)) {
        return false;
      }
      return (
        isHexString(tx.maxFeePerGas || '') &&
        isHexString(tx.maxPriorityFeePerGas || '')
      );
    },
    is7702Tx: (tx: any) =>
      Array.isArray(tx?.authorizationList) && tx.authorizationList.length > 0,
    validateGasPriceRange: jest.fn(() => true),
  };
});

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: jest.fn(),
}));

jest.mock('@/utils/events', () => ({
  eventBus: {
    emit: jest.fn(),
  },
  EVENTS: {
    TX_SUBMITTING: 'TX_SUBMITTING',
    AUTO_LOGIN_GAS_ACCOUNT: 'AUTO_LOGIN_GAS_ACCOUNT',
    COMMON_HARDWARE: {
      REJECTED: 'COMMON_HARDWARE_REJECTED',
    },
  },
}));

jest.mock('@/utils/stats', () => ({
  stats: {
    report: jest.fn(),
  },
}));

jest.mock('@/utils/analytics', () => ({
  matomoRequestEvent: jest.fn(),
}));

jest.mock('@/databases/sync/utils', () => ({
  updateExpiredTime: jest.fn(async () => undefined),
}));

jest.mock('@/utils/gasAccountAnalytics', () => ({
  handleGasAccountLoginSuccess: jest.fn(async () => undefined),
}));

import providerController from './provider';

const DAPP_ORIGIN = 'https://attacker.example';

const ACCOUNT = {
  address: '0x1111111111111111111111111111111111111111',
  type: KEYRING_TYPE.SimpleKeyring,
  brandName: 'Rabby',
};

const TX_PARAMS = {
  from: ACCOUNT.address,
  to: '0x2222222222222222222222222222222222222222',
  data: '0x',
  value: '0x0',
};

const makeApprovalRes = (overrides: Record<string, unknown> = {}) => ({
  chainId: 1,
  nonce: '0x1',
  gas: '0x5208',
  gasPrice: '0x3b9aca00',
  from: TX_PARAMS.from,
  to: TX_PARAMS.to,
  data: TX_PARAMS.data,
  value: TX_PARAMS.value,
  signingTxId: 'test-signing-tx-id',
  extra: {},
  ...overrides,
});

const makeOptions = (overrides: Record<string, unknown> = {}) =>
  ({
    data: {
      params: [{ ...TX_PARAMS }],
    },
    session: {
      origin: DAPP_ORIGIN,
      name: 'Attacker Dapp',
      icon: '',
    },
    approvalRes: makeApprovalRes(),
    pushed: false,
    result: undefined,
    account: ACCOUNT,
    ...overrides,
  } as any);

describe('provider.ethSendTransaction broadcast chain pinning', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFindChain.mockImplementation(
      ({ enum: chainEnum, id, serverId }: any = {}) =>
        KNOWN_CHAINS.find(
          chain =>
            (id != null && chain.id === id) ||
            (chainEnum != null && chain.enum === chainEnum) ||
            (serverId != null && chain.serverId === serverId),
        ) || null,
    );
    mockFindChainByEnum.mockImplementation(
      (chainEnum: string) =>
        KNOWN_CHAINS.find(chain => chain.enum === chainEnum) || null,
    );

    // non-internal dapp that has silently switched to an attacker chain
    mockIsInternalDappSnapshot.mockReturnValue(false);
    mockGetConnectedDappSnapshot.mockReturnValue({
      origin: DAPP_ORIGIN,
      chainId: ATTACKER_CHAIN.enum,
      isConnected: true,
    });
    mockGetDappSnapshot.mockReturnValue({
      origin: DAPP_ORIGIN,
      chainId: ATTACKER_CHAIN.enum,
      isConnected: true,
    });

    mockGetKeyringForAccount.mockResolvedValue({});
    mockSignTransaction.mockResolvedValue({
      r: '0x01',
      s: '0x02',
      v: '0x1b',
    });

    mockGetSigningTx.mockResolvedValue({
      rawTx: {
        from: TX_PARAMS.from,
        to: TX_PARAMS.to,
        data: TX_PARAMS.data,
        value: TX_PARAMS.value,
        nonce: '0x1',
        chainId: 1,
        gas: '0x5208',
        gasPrice: '0x3b9aca00',
      },
      explain: {
        pre_exec: { success: true },
        calcSuccess: true,
      },
    });
    mockUpdateSigningTx.mockResolvedValue(undefined);
    mockAddHistoryTx.mockResolvedValue(undefined);
    mockRemoveSigningTx.mockResolvedValue(undefined);
    mockWatcherAddTx.mockResolvedValue(undefined);
    mockBroadcastWatcherAddTx.mockResolvedValue(undefined);
    mockPostSwap.mockResolvedValue(undefined);
    mockPostBridge.mockResolvedValue(undefined);

    // no custom RPC / default-RPC push: broadcast falls through to submitTxV2
    mockHasCustomRPC.mockResolvedValue(false);
    mockGetDefaultRPC.mockResolvedValue(null);
    mockProbeBestRPC.mockResolvedValue(undefined);
    mockGetCustomTestnetClient.mockResolvedValue({
      request: jest.fn(async () => '0xattackerpushed'),
    });
    mockSubmitTxV2.mockResolvedValue({ tx_id: '0xabc' });
  });

  it('broadcasts on the approved chain when the dapp switched chains mid-approval', async () => {
    // approvalRes was reviewed and signed for mainnet (chainId 1), but the
    // connected dapp now reports the attacker's custom testnet.
    const result = await providerController.ethSendTransaction(makeOptions());

    expect(result).toBe('0xabc');
    // the signed mainnet tx must not be pushed to the attacker testnet RPC
    expect(mockGetCustomTestnetClient).not.toHaveBeenCalled();
    // the broadcast target is the approved chain, not the connected dapp chain
    expect(mockHasCustomRPC).toHaveBeenCalledWith(ETH_CHAIN.enum);
    expect(mockSubmitTxV2).toHaveBeenCalledTimes(1);
    expect(mockSubmitTxV2.mock.calls[0][0].context.tx.chainId).toBe(1);
  });

  it('keeps the WalletConnect requestContext chain as the highest-priority broadcast target', async () => {
    const result = await providerController.ethSendTransaction(
      makeOptions({
        requestContext: {
          origin: DAPP_ORIGIN,
          source: 'walletconnect',
          chainId: BSC_CHAIN.id,
          accountAddress: ACCOUNT.address,
        },
      }),
    );

    expect(result).toBe('0xabc');
    expect(mockHasCustomRPC).toHaveBeenCalledWith(BSC_CHAIN.enum);
    expect(mockGetCustomTestnetClient).not.toHaveBeenCalled();
    expect(mockSubmitTxV2).toHaveBeenCalledTimes(1);
  });
});
