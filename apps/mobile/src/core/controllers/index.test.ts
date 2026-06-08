import provider from './index';
import rpcFlow from './rpcFlow';

const walletConnectAccount = {
  address: '0x1111111111111111111111111111111111111111',
  type: 'Simple Key Pair',
  brandName: 'Rabby',
};

jest.mock('../services', () => ({
  dappService: {
    getDapp: jest.fn(() => undefined),
  },
  keyringService: {
    hasVault: jest.fn(() => true),
  },
  preferenceService: {
    getFallbackAccount: jest.fn(() => null),
  },
}));

jest.mock('@/constant', () => ({
  INTERNAL_REQUEST_ORIGIN: 'rabby-internal-request',
}));

jest.mock('./internalMethod', () => ({}));

jest.mock('./rpcFlow', () => jest.fn(async request => request.account));

describe('provider entrypoint', () => {
  beforeEach(() => {
    jest.mocked(rpcFlow).mockClear();
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
});
