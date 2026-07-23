import provider from './index';
import rpcFlow from './rpcFlow';

const mockEnsureDappServiceReady = jest.fn();
const mockGetDappSnapshot = jest.fn();
const mockInternalMethod = jest.fn();

const walletConnectAccount = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
};

jest.mock('@/core/serviceApi/dapp', () => ({
  ensureDappServiceReady: (...args: unknown[]) =>
    mockEnsureDappServiceReady(...args),
  getDappSnapshot: (...args: unknown[]) => mockGetDappSnapshot(...args),
}));

jest.mock('@/core/serviceApi/keyring', () => ({
  keyringServiceApi: {
    hasVault: jest.fn(async () => true),
  },
}));

jest.mock('@/core/serviceApi/preference', () => ({
  getFallbackAccountSnapshot: jest.fn(() => null),
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'rabby-internal-request',
}));

jest.mock('./internalMethod', () => ({
  rabby_testInternal: (...args: unknown[]) => mockInternalMethod(...args),
}));

jest.mock('./rpcFlow', () => jest.fn(async request => request.account));

describe('provider entrypoint', () => {
  beforeEach(() => {
    jest.mocked(rpcFlow).mockClear();
    mockEnsureDappServiceReady.mockReset();
    mockGetDappSnapshot.mockReset();
    mockInternalMethod.mockReset();
    mockGetDappSnapshot.mockReturnValue(undefined);
  });

  it('preserves WalletConnect account instead of deriving it from dappService', async () => {
    await provider({
      data: {
        method: 'personal_sign',
        params: [],
      },
      session: {
        origin: 'https://example.com',
        name: 'Example dapp',
        icon: '',
        $mobileCtx: {
          isFromWalletConnect: true,
        },
      },
      account: walletConnectAccount,
      requestContext: {
        origin: 'https://example.com',
        source: 'walletconnect',
        chainId: 1,
        accountAddress: walletConnectAccount.address,
      },
    });

    expect(rpcFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        account: walletConnectAccount,
      }),
    );
  });

  it('activates dapp state before reading a browser session account', async () => {
    let finishActivation: (() => void) | undefined;
    mockEnsureDappServiceReady.mockReturnValue(
      new Promise<void>(resolve => {
        finishActivation = resolve;
      }),
    );

    const request = provider({
      data: {
        method: 'wallet_importAddress',
        params: [],
      },
      session: {
        origin: 'https://example.com',
        name: 'Example dapp',
        icon: '',
      },
    } as any);

    await Promise.resolve();
    expect(mockGetDappSnapshot).not.toHaveBeenCalled();

    finishActivation?.();
    await request;

    expect(mockGetDappSnapshot).toHaveBeenCalledWith('https://example.com');
  });

  it('activates dapp state before dispatching an internal method', async () => {
    let finishActivation: (() => void) | undefined;
    mockEnsureDappServiceReady.mockReturnValue(
      new Promise<void>(resolve => {
        finishActivation = resolve;
      }),
    );

    const request = provider({
      data: {
        method: 'rabby_testInternal',
        params: [],
      },
      session: {
        origin: 'rabby-internal-request',
        name: 'Rabby internal',
        icon: '',
      },
    } as any);

    await Promise.resolve();
    expect(mockInternalMethod).not.toHaveBeenCalled();

    finishActivation?.();
    await request;

    expect(mockInternalMethod).toHaveBeenCalledTimes(1);
  });
});
