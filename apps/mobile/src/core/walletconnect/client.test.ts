import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import { handleWalletConnectSessionProposal } from './client';
import {
  forgetWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingBrowserOrigin,
  rememberWalletConnectPairingBrowserOrigin,
} from './pairingBrowserOrigin';
import { storeWalletConnectProposal } from './proposal';
import type { WalletConnectDebugState } from './types';

let mockState: WalletConnectDebugState;

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));
jest.mock('@/constant/env', () => ({
  RABBY_MOBILE_WALLETCONNECT_PROJECT_ID: 'test-project-id',
}));
jest.mock('./autoDisconnect', () => ({
  clearWalletConnectAutoDisconnectTopic: jest.fn(),
  disconnectRestoredWalletConnectSessionsForAutoDisconnect: jest.fn(),
}));
jest.mock('./debugLog', () => ({ addWalletConnectLog: jest.fn() }));
jest.mock('./error', () => ({
  getWalletConnectErrorMessage: jest.fn((error: Error) => error.message),
}));
jest.mock('./metadata', () => ({ WALLETCONNECT_CLIENT_METADATA: {} }));
jest.mock('./proposal', () => ({
  clearWalletConnectProposal: jest.fn(),
  storeWalletConnectProposal: jest.fn(),
}));
jest.mock('./accountPersistence', () => ({
  forgetWalletConnectAccountForTopic: jest.fn(),
}));
jest.mock('./redirectState', () => ({
  clearWalletConnectDappRedirectPending: jest.fn(),
}));
jest.mock('./requestBridge', () => ({
  handleWalletConnectSessionRequest: jest.fn(),
}));
jest.mock('./sessions', () => ({
  syncWalletConnectSessionsFromClient: jest.fn(),
}));
jest.mock('./state', () => ({
  getWalletConnectDebugState: () => mockState,
  setWalletConnectClientStatus: jest.fn(),
  setWalletConnectDebugState: jest.fn(),
}));
jest.mock('./storage', () => ({ walletConnectStorage: {} }));
jest.mock('./uiEvents', () => ({ emitWalletConnectUiEvent: jest.fn() }));
jest.mock('../utils/androidTrace', () => ({
  traceAndroidInstant: jest.fn(),
}));

function makeProposal(
  pairingTopic: string,
  dappUrl: string,
): WalletKitTypes.SessionProposal {
  return {
    id: 1,
    params: {
      pairingTopic,
      proposer: {
        publicKey: 'public-key',
        metadata: {
          name: 'Example',
          description: '',
          url: dappUrl,
          icons: [],
        },
      },
      requiredNamespaces: {},
      optionalNamespaces: {},
    },
    verifyContext: {
      verified: {
        origin: dappUrl,
        validation: 'UNKNOWN',
        verifyUrl: '',
      },
    },
  } as unknown as WalletKitTypes.SessionProposal;
}

function makeWalletKit() {
  return {
    rejectSession: jest.fn().mockResolvedValue(undefined),
    core: {
      pairing: {
        disconnect: jest.fn().mockResolvedValue(undefined),
      },
    },
  } as unknown as IWalletKit;
}

describe('WalletConnect browser-origin proposals', () => {
  const topic = 'browser-origin-topic';

  beforeEach(() => {
    mockState = {
      projectId: 'test-project-id',
      client: { status: 'ready' },
      pairing: { status: 'pairing', source: 'inner-webview' },
      sessions: [],
      log: [],
    };
    jest.mocked(storeWalletConnectProposal).mockClear();
    forgetWalletConnectPairingBrowserOrigin(topic);
    expect(
      rememberWalletConnectPairingBrowserOrigin({
        topic,
        browserOrigin: 'https://app.example',
      }),
    ).toBe(true);
  });

  afterEach(() => {
    forgetWalletConnectPairingBrowserOrigin(topic);
  });

  it('stores a proposal with the same declared origin', () => {
    const walletKit = makeWalletKit();
    handleWalletConnectSessionProposal(
      walletKit,
      makeProposal(topic, 'https://app.example/path'),
    );

    expect(walletKit.rejectSession).not.toHaveBeenCalled();
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'inner-webview' }),
    );
  });

  it('keeps a QR proposal on the original path', () => {
    forgetWalletConnectPairingBrowserOrigin(topic);
    mockState.pairing.source = 'qr';
    const walletKit = makeWalletKit();

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposal(topic, 'https://app.example'),
    );

    expect(walletKit.rejectSession).not.toHaveBeenCalled();
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'qr' }),
    );
  });

  it('rejects and disconnects a proposal with a different origin', async () => {
    const walletKit = makeWalletKit();
    handleWalletConnectSessionProposal(
      walletKit,
      makeProposal(topic, 'https://other.example'),
    );
    await new Promise(resolve => setImmediate(resolve));

    expect(storeWalletConnectProposal).not.toHaveBeenCalled();
    expect(walletKit.rejectSession).toHaveBeenCalled();
    expect(walletKit.core.pairing.disconnect).toHaveBeenCalledWith({ topic });
    expect(getWalletConnectPairingBrowserOrigin(topic)).toBeNull();
  });
});
