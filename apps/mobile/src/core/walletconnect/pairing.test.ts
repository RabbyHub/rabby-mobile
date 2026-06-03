import { initWalletConnect } from './client';
import { pairWalletConnectUri } from './pairing';
import type { WalletConnectDebugState } from './types';

const WC_URI =
  'wc:abc123@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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
