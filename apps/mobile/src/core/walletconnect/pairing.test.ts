import { initWalletConnect } from './client';
import {
  pairWalletConnectUri,
  WALLETCONNECT_PROPOSAL_WAIT_MS,
} from './pairing';
import {
  forgetWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingBrowserOrigin,
} from './pairingBrowserOrigin';
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

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    forgetWalletConnectPairingBrowserOrigin('abc123');
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
    expect(getWalletConnectPairingBrowserOrigin('abc123')).toBeNull();
  });

  it('binds a strict WebView pairing to its source origin', async () => {
    const walletKit = {
      pair: jest.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof initWalletConnect>>;
    jest.mocked(initWalletConnect).mockResolvedValue(walletKit);

    await pairWalletConnectUri({
      uri: WC_URI,
      source: 'inner-webview',
      browserOrigin: 'https://app.example/path',
    });

    expect(getWalletConnectPairingBrowserOrigin('abc123')).toBe(
      'https://app.example',
    );
  });

  it('fails before pairing when a WebView origin is invalid', async () => {
    await expect(
      pairWalletConnectUri({
        uri: WC_URI,
        source: 'inner-webview',
        browserOrigin: '',
      }),
    ).rejects.toThrow();

    expect(initWalletConnect).not.toHaveBeenCalled();
    expect(getWalletConnectPairingBrowserOrigin('abc123')).toBeNull();
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

  it('marks pairing as error when no proposal arrives in time', async () => {
    const walletKit = {
      pair: jest.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof initWalletConnect>>;
    jest.mocked(initWalletConnect).mockResolvedValue(walletKit);

    await pairWalletConnectUri({
      uri: WC_URI,
      source: 'qr',
    });

    jest.advanceTimersByTime(WALLETCONNECT_PROPOSAL_WAIT_MS - 1);
    expect(mockState.pairing.status).toBe('pairing');

    jest.advanceTimersByTime(1);
    expect(mockState.pairing).toMatchObject({
      status: 'error',
      uri: WC_URI,
    });
  });

  it('keeps proposal state when the proposal wait times out', async () => {
    const walletKit = {
      pair: jest.fn().mockImplementation(async () => {
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
    jest.advanceTimersByTime(WALLETCONNECT_PROPOSAL_WAIT_MS);

    expect(mockState.pairing.status).toBe('proposal');
    expect(mockState.pairing.error).toBeUndefined();
  });
});
