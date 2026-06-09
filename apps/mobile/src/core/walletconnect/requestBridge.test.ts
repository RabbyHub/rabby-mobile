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
const goerliChain = {
  enum: 'GOERLI',
  id: 5,
  serverId: 'goerli',
  hex: '0x5',
  network: '5',
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
  emitSessionEvent: jest.fn(),
  respondSessionRequest: jest.fn(),
};

jest.mock('@/core/apis/sendRequest', () => ({
  sendRequest: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: mockAppState,
}));

jest.mock('./chainAccount', () => ({
  chainToCaip2: jest.fn((input: { id: number }) => `eip155:${input.id}`),
  getWalletConnectChainByCaip2: jest.fn((chainId?: string | null) => {
    if (chainId === 'eip155:5') {
      return goerliChain;
    }
    return chain;
  }),
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
  getWalletConnectApprovedChains: jest.fn(() => ['eip155:1']),
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
const { getWalletConnectApprovedChains } =
  require('./sessions') as typeof import('./sessions');

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
    walletKit.emitSessionEvent.mockReset();
    walletKit.respondSessionRequest.mockReset();
    jest.mocked(getWalletConnectApprovedChains).mockReturnValue(['eip155:1']);
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

  it('handles wallet_switchEthereumChain inside WalletConnect', async () => {
    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: {
        ...makeEvent('wallet_switchEthereumChain'),
        params: {
          ...makeEvent('wallet_switchEthereumChain').params,
          request: {
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x1' }],
          },
        },
      } as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(walletKit.emitSessionEvent).toHaveBeenCalledWith({
      topic: 'topic-1',
      chainId: 'eip155:1',
      event: {
        name: 'chainChanged',
        data: 'eip155:1',
      },
    });
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        result: null,
      },
    });
    expect(maybeRedirectToDapp).toHaveBeenCalledWith({
      nativeRedirect: undefined,
    });
  });

  it('rejects wallet_switchEthereumChain when the target chain is not approved', async () => {
    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: {
        ...makeEvent('wallet_switchEthereumChain'),
        params: {
          ...makeEvent('wallet_switchEthereumChain').params,
          request: {
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x5' }],
          },
        },
      } as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(walletKit.emitSessionEvent).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: 4902,
          message:
            'WalletConnect chain is not approved for this session: eip155:5',
        }),
      },
    });
  });

  it('rejects wallet_addEthereumChain from WalletConnect before provider forwarding', async () => {
    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: {
        ...makeEvent('wallet_addEthereumChain'),
        params: {
          ...makeEvent('wallet_addEthereumChain').params,
          request: {
            method: 'wallet_addEthereumChain',
            params: [{ chainId: '0x1' }],
          },
        },
      } as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        error: expect.objectContaining({
          message:
            'WalletConnect method is not supported: wallet_addEthereumChain',
        }),
      },
    });
    expect(maybeRedirectToDapp).not.toHaveBeenCalled();
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
