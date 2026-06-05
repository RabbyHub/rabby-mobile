const mockAppStateListeners = new Set<(state: string) => void>();
const mockAppState = {
  isAvailable: true,
  currentState: 'active',
  addEventListener: jest.fn(
    (_event: 'change', listener: (state: string) => void) => {
      mockAppStateListeners.add(listener);
      return {
        remove: jest.fn(() => {
          mockAppStateListeners.delete(listener);
        }),
      };
    },
  ),
};

const chain = {
  enum: 'ETH',
  id: 1,
  serverId: 'eth',
  hex: '0x1',
  network: '1',
};
const account = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
};
const session = {
  topic: 'topic-1',
  peer: {
    metadata: {
      name: 'Example dapp',
      url: 'https://example.com',
      icons: [],
    },
  },
};
const walletKit = {
  getActiveSessions: jest.fn(() => ({
    [session.topic]: session,
  })),
  respondSessionRequest: jest.fn(),
};

jest.mock('@/core/apis/sendRequest', () => ({
  sendRequest: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: mockAppState,
}));

jest.mock('./chainAccount', () => ({
  getWalletConnectChainByCaip2: jest.fn(() => chain),
  isSupportedWalletConnectMethod: jest.fn((method: string) => {
    const { WALLETCONNECT_SUPPORTED_METHODS } =
      jest.requireActual('./constants');
    return WALLETCONNECT_SUPPORTED_METHODS.includes(method);
  }),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./redirectPolicy', () => ({
  maybeRedirectToDapp: jest.fn(),
}));

jest.mock('./autoDisconnect', () => ({
  recordWalletConnectSessionActivity: jest.fn(),
}));

jest.mock('./sessions', () => ({
  getFirstApprovedChain: jest.fn(() => chain),
  getWalletConnectSession: jest.fn(() => session),
  getWalletConnectSessionOrigin: jest.fn(() => 'https://example.com'),
  resolveWalletConnectAccount: jest.fn(() => account),
  syncWalletConnectSessionsFromClient: jest.fn(),
}));

const { sendRequest } =
  require('@/core/apis/sendRequest') as typeof import('@/core/apis/sendRequest');
const { handleWalletConnectSessionRequest } =
  require('./requestBridge') as typeof import('./requestBridge');
const { maybeRedirectToDapp } =
  require('./redirectPolicy') as typeof import('./redirectPolicy');

function makeEvent(method: string) {
  return {
    id: 1,
    topic: 'topic-1',
    params: {
      chainId: 'eip155:1',
      request: {
        method,
        params: [],
      },
    },
  };
}

describe('walletconnect request bridge', () => {
  beforeEach(() => {
    jest.mocked(sendRequest).mockReset();
    walletKit.getActiveSessions.mockClear();
    walletKit.respondSessionRequest.mockReset();
    jest.mocked(maybeRedirectToDapp).mockReset();
    mockAppState.currentState = 'active';
    mockAppStateListeners.clear();
    mockAppState.addEventListener.mockClear();
  });

  it('responds to eth_chainId directly', async () => {
    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_chainId') as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        result: '0x1',
      },
    });
    expect(maybeRedirectToDapp).not.toHaveBeenCalled();
  });

  it('forwards signing requests to the provider with WalletConnect context', async () => {
    jest.mocked(sendRequest).mockResolvedValue('0xsigned');

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('personal_sign') as never,
    });

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        account,
        requestContext: expect.objectContaining({
          source: 'walletconnect',
          chainId: 1,
          accountAddress: account.address,
        }),
      }),
    );
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        result: '0xsigned',
      },
    });
    expect(maybeRedirectToDapp).toHaveBeenCalledWith({
      nativeRedirect: undefined,
    });
  });

  it('waits until the app is active before forwarding approval requests', async () => {
    jest.mocked(sendRequest).mockResolvedValue('0xsigned');
    mockAppState.currentState = 'background';

    const requestPromise = handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_sendTransaction') as never,
    });

    await Promise.resolve();

    expect(sendRequest).not.toHaveBeenCalled();
    expect(mockAppState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );

    mockAppState.currentState = 'active';
    mockAppStateListeners.forEach(listener => listener('active'));

    await requestPromise;

    expect(sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestContext: expect.objectContaining({
          source: 'walletconnect',
        }),
      }),
    );
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        result: '0xsigned',
      },
    });
  });
});
