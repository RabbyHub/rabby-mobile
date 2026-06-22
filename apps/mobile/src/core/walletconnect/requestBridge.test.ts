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

jest.mock('@/core/apis/readOnlyRpc', () => ({
  requestReadOnlyETHRpc: jest.fn(),
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
  getWalletConnectApprovedChains: jest.fn(() => ['eip155:1']),
  getWalletConnectSession: jest.fn(() => session),
  getWalletConnectSessionOrigin: jest.fn(() => 'https://example.com'),
  isWalletConnectMethodApproved: jest.fn(() => true),
  resolveWalletConnectAccount: jest.fn(() => account),
  syncWalletConnectSessionsFromClient: jest.fn(),
}));

const { sendRequest } =
  require('@/core/apis/sendRequest') as typeof import('@/core/apis/sendRequest');
const { requestReadOnlyETHRpc } =
  require('@/core/apis/readOnlyRpc') as typeof import('@/core/apis/readOnlyRpc');
const { handleWalletConnectSessionRequest } =
  require('./requestBridge') as typeof import('./requestBridge');
const { maybeRedirectToDapp } =
  require('./redirectPolicy') as typeof import('./redirectPolicy');
const { getWalletConnectApprovedChains } =
  require('./sessions') as typeof import('./sessions');
const { getWalletConnectSession } =
  require('./sessions') as typeof import('./sessions');
const { isWalletConnectMethodApproved } =
  require('./sessions') as typeof import('./sessions');

function makeEvent(method: string, params: unknown[] = []) {
  return {
    id: 1,
    topic: 'topic-1',
    params: {
      chainId: 'eip155:1',
      request: {
        method,
        params,
      },
    },
  };
}

const readOnlyRpcCases: Array<[string, unknown[]]> = [
  [
    'eth_call',
    [
      {
        to: '0x2222222222222222222222222222222222222222',
        data: '0x1234',
      },
      'latest',
    ],
  ],
  [
    'eth_getLogs',
    [
      {
        address: '0x2222222222222222222222222222222222222222',
        fromBlock: '0x1',
        toBlock: 'latest',
      },
    ],
  ],
];

describe('walletconnect request bridge', () => {
  beforeEach(() => {
    jest.mocked(sendRequest).mockReset();
    jest.mocked(requestReadOnlyETHRpc).mockReset();
    walletKit.getActiveSessions.mockClear();
    walletKit.emitSessionEvent.mockReset();
    walletKit.respondSessionRequest.mockReset();
    jest.mocked(getWalletConnectSession).mockReturnValue(session as never);
    jest.mocked(getWalletConnectApprovedChains).mockReturnValue(['eip155:1']);
    jest.mocked(isWalletConnectMethodApproved).mockReturnValue(true);
    jest.mocked(maybeRedirectToDapp).mockReset();
    jest.mocked(maybeRedirectToDapp).mockResolvedValue(false);
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

  it.each(readOnlyRpcCases)(
    'responds to %s through the read-only RPC path without waiting for foreground',
    async (method, params) => {
      jest.mocked(requestReadOnlyETHRpc).mockResolvedValue(`${method}-result`);
      mockAppState.currentState = 'background';

      await handleWalletConnectSessionRequest({
        walletKit: walletKit as never,
        event: makeEvent(method, params) as never,
      });

      expect(requestReadOnlyETHRpc).toHaveBeenCalledWith(
        {
          method,
          params,
        },
        'eth',
        account,
      );
      expect(sendRequest).not.toHaveBeenCalled();
      expect(mockAppState.addEventListener).not.toHaveBeenCalled();
      expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
        topic: 'topic-1',
        response: {
          id: 1,
          jsonrpc: '2.0',
          result: `${method}-result`,
        },
      });
      expect(maybeRedirectToDapp).not.toHaveBeenCalled();
    },
  );

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
      iosNoRedirectToast: {
        variant: 'success',
        message: 'Transaction sent! Please return to the Dapp.',
      },
    });
  });

  it('passes an iOS return toast for transaction responses', async () => {
    jest.mocked(sendRequest).mockResolvedValue('0xtransaction');

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_sendTransaction') as never,
    });

    expect(maybeRedirectToDapp).toHaveBeenCalledWith({
      nativeRedirect: undefined,
      iosNoRedirectToast: {
        variant: 'success',
        message: 'Transaction sent! Please return to the Dapp.',
      },
    });
  });

  it('passes an iOS return toast for transaction errors', async () => {
    jest
      .mocked(sendRequest)
      .mockRejectedValue(
        Object.assign(new Error('User Cancel'), { code: 4001 }),
      );

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_sendTransaction') as never,
    });

    expect(maybeRedirectToDapp).toHaveBeenCalledWith({
      nativeRedirect: undefined,
      iosNoRedirectToast: {
        variant: 'error',
        message: 'Transaction canceled! Please return to the Dapp.',
      },
    });
  });

  it('does not redirect after read-only RPC responses', async () => {
    jest.mocked(requestReadOnlyETHRpc).mockResolvedValue('0x123');

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_blockNumber') as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(maybeRedirectToDapp).not.toHaveBeenCalled();
  });

  it('does not pass a transaction return toast for missing sessions', async () => {
    jest.mocked(getWalletConnectSession).mockReturnValue(undefined as never);

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('eth_sendTransaction') as never,
    });

    expect(maybeRedirectToDapp).not.toHaveBeenCalled();
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
        data: '0x1',
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
    expect(maybeRedirectToDapp).not.toHaveBeenCalled();
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

  it('rejects requests when the event chain is not approved for the session', async () => {
    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: {
        ...makeEvent('personal_sign'),
        params: {
          ...makeEvent('personal_sign').params,
          chainId: 'eip155:5',
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
          code: 4902,
          message:
            'WalletConnect chain is not approved for this session: eip155:5',
        }),
      },
    });
  });

  it('rejects requests when the method is not approved for the session chain', async () => {
    jest.mocked(isWalletConnectMethodApproved).mockReturnValue(false);

    await handleWalletConnectSessionRequest({
      walletKit: walletKit as never,
      event: makeEvent('personal_sign') as never,
    });

    expect(sendRequest).not.toHaveBeenCalled();
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith({
      topic: 'topic-1',
      response: {
        id: 1,
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: 4100,
          message:
            'WalletConnect method is not approved for this session: personal_sign',
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
