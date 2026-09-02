import { initWalletConnect } from './client';
import { pairWalletConnectUri } from './pairing';
import type { WalletConnectDebugState } from './types';

const WC_URI =
  'wc:abc123@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const NEXT_WC_URI =
  'wc:def456@2?relay-protocol=irn&symKey=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';

let mockState: WalletConnectDebugState;

type MockStateUpdater =
  | Partial<WalletConnectDebugState>
  | ((prev: WalletConnectDebugState) => WalletConnectDebugState);

jest.mock('./client', () => ({
  initWalletConnect: jest.fn(),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./state', () => ({
  getWalletConnectDebugState: () => mockState,
  setWalletConnectDebugState: (updater: MockStateUpdater) => {
    mockState =
      typeof updater === 'function'
        ? updater(mockState)
        : {
            ...mockState,
            ...updater,
          };
  },
}));

describe('walletconnect pairing', () => {
  beforeEach(() => {
    mockState = {
      projectId: 'test-project-id',
      client: {
        status: 'idle',
      },
      pairing: {
        status: 'idle',
      },
      sessions: [],
      log: [],
    };
    jest.mocked(initWalletConnect).mockReset();
  });

  it('keeps pairing pending after WalletKit accepts the URI', async () => {
    const walletKit = {
      pair: jest.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof initWalletConnect>>;
    jest.mocked(initWalletConnect).mockResolvedValue(walletKit);

    await pairWalletConnectUri({
      uri: WC_URI,
      source: 'qr',
    });

    expect(walletKit.pair).toHaveBeenCalledWith({
      uri: WC_URI,
    });
    expect(mockState.pairing).toMatchObject({
      status: 'pairing',
      uri: WC_URI,
      source: 'qr',
    });
  });

  it('does not overwrite proposal state when proposal arrives before pair resolves', async () => {
    const walletKit = {
      pair: jest.fn(async () => {
        mockState = {
          ...mockState,
          pairing: {
            ...mockState.pairing,
            status: 'proposal',
          },
        };
      }),
    } as unknown as Awaited<ReturnType<typeof initWalletConnect>>;
    jest.mocked(initWalletConnect).mockResolvedValue(walletKit);

    await pairWalletConnectUri({
      uri: WC_URI,
      source: 'qr',
    });

    expect(mockState.pairing).toMatchObject({
      status: 'proposal',
      uri: WC_URI,
      source: 'qr',
    });
  });

  it('does not overwrite a newer pairing when an older URI fails late', async () => {
    const walletKit = {
      pair: jest.fn(async () => {
        mockState = {
          ...mockState,
          pairing: {
            status: 'pairing',
            source: 'manual',
            uri: NEXT_WC_URI,
          },
        };
        throw new Error('expired');
      }),
    } as unknown as Awaited<ReturnType<typeof initWalletConnect>>;
    jest.mocked(initWalletConnect).mockResolvedValue(walletKit);

    await expect(
      pairWalletConnectUri({
        uri: WC_URI,
        source: 'qr',
      }),
    ).rejects.toThrow(
      'WalletConnect pairing expired. Refresh the dapp QR code and try again.',
    );

    expect(mockState.pairing).toMatchObject({
      status: 'pairing',
      uri: NEXT_WC_URI,
      source: 'manual',
    });
  });

  it('marks pairing as error when WalletKit initialization fails', async () => {
    jest
      .mocked(initWalletConnect)
      .mockRejectedValue(new Error('Missing WalletConnect project id.'));

    await expect(
      pairWalletConnectUri({
        uri: WC_URI,
        source: 'qr',
      }),
    ).rejects.toThrow('Missing WalletConnect project id.');

    expect(mockState.pairing).toMatchObject({
      status: 'error',
      error: 'Missing WalletConnect project id.',
    });
  });
});
