import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import { handleWalletConnectSessionProposal } from './client';
import { addWalletConnectLog } from './debugLog';
import { rememberWalletConnectPairingBrowserOrigin } from './pairingBrowserOrigin';
import { storeWalletConnectProposal } from './proposal';
import { setWalletConnectDebugState } from './state';
import { emitWalletConnectUiEvent } from './uiEvents';
import type { WalletConnectDebugState } from './types';

let mockState: WalletConnectDebugState;

jest.mock('@/utils/i18n', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock('@/constant/env', () => ({
  RABBY_MOBILE_WALLETCONNECT_PROJECT_ID: 'test-project-id',
}));

jest.mock('@walletconnect/utils', () => ({
  getSdkError: jest.fn((key: string) => ({ code: 5000, message: key })),
}));

jest.mock('./autoDisconnect', () => ({
  clearWalletConnectAutoDisconnectTopic: jest.fn(),
  disconnectRestoredWalletConnectSessionsForAutoDisconnect: jest.fn(),
}));

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('./error', () => ({
  getWalletConnectErrorMessage: jest.fn((error: Error) => error.message),
}));

jest.mock('./metadata', () => ({
  WALLETCONNECT_CLIENT_METADATA: {},
}));

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

jest.mock('./storage', () => ({
  walletConnectStorage: {},
}));

jest.mock('./uiEvents', () => ({
  emitWalletConnectUiEvent: jest.fn(),
}));

jest.mock('../utils/androidTrace', () => ({
  traceAndroidInstant: jest.fn(),
}));

function makeProposalEvent(input: {
  id?: number;
  pairingTopic?: string;
  dappUrl?: string;
}): WalletKitTypes.SessionProposal {
  return {
    id: input.id ?? 1,
    params: {
      pairingTopic: input.pairingTopic ?? 'topic-pair',
      proposer: {
        publicKey: 'public-key',
        metadata: {
          name: 'Example dapp',
          description: '',
          url: input.dappUrl ?? 'https://app.uniswap.org',
          icons: [],
        },
      },
      requiredNamespaces: {},
      optionalNamespaces: {},
    },
    verifyContext: {
      verified: {
        origin: 'https://app.uniswap.org',
        validation: 'VALID',
        verifyUrl: 'https://verify.walletconnect.org',
      },
    },
  } as unknown as WalletKitTypes.SessionProposal;
}

describe('handleWalletConnectSessionProposal', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockState = {
      projectId: 'test-project-id',
      client: { status: 'ready' },
      pairing: { status: 'pairing', source: 'inner-webview' },
      sessions: [],
      log: [],
    };
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.mocked(storeWalletConnectProposal).mockClear();
    jest.mocked(setWalletConnectDebugState).mockClear();
    jest.mocked(emitWalletConnectUiEvent).mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  function makeWalletKit() {
    return {
      rejectSession: jest.fn().mockResolvedValue(undefined),
    } as unknown as IWalletKit;
  }

  it('rejects inner-webview proposals whose declared origin mismatches the browser origin', () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-mismatch',
      'https://evil.example',
    );
    const walletKit = makeWalletKit();

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 11,
        pairingTopic: 'topic-mismatch',
        dappUrl: 'https://app.uniswap.org',
      }),
    );

    expect(walletKit.rejectSession).toHaveBeenCalledWith({
      id: 11,
      reason: expect.objectContaining({ message: 'USER_REJECTED' }),
    });
    expect(storeWalletConnectProposal).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    // closes the pairing loading modal and shows a generic error toast
    expect(emitWalletConnectUiEvent).toHaveBeenCalledWith({
      type: 'pairingError',
      message: 'page.walletConnect.pairingFailed',
    });
    const stateUpdater = jest.mocked(setWalletConnectDebugState).mock
      .calls[0]?.[0];
    const nextState =
      typeof stateUpdater === 'function' ? stateUpdater(mockState) : mockState;
    expect(nextState.pairing).toMatchObject({
      status: 'error',
      error: 'page.walletConnect.pairingFailed',
    });
  });

  it('stores inner-webview proposals whose declared origin matches the browser origin', () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-match',
      'https://uniswap.org',
    );
    const walletKit = makeWalletKit();

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 12,
        pairingTopic: 'topic-match',
        dappUrl: 'https://app.uniswap.org',
      }),
    );

    expect(walletKit.rejectSession).not.toHaveBeenCalled();
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 12,
        source: 'inner-webview',
        verifyContext: expect.objectContaining({
          verified: expect.objectContaining({ validation: 'VALID' }),
        }),
      }),
    );
    expect(emitWalletConnectUiEvent).not.toHaveBeenCalled();
  });

  it('stores inner-webview proposals when the browser origin is unknown', () => {
    const walletKit = makeWalletKit();

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 13,
        pairingTopic: 'topic-unknown-origin',
        dappUrl: 'https://app.uniswap.org',
      }),
    );

    expect(walletKit.rejectSession).not.toHaveBeenCalled();
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 13, source: 'inner-webview' }),
    );
    expect(emitWalletConnectUiEvent).not.toHaveBeenCalled();
  });

  it('stores proposals from non inner-webview sources without an origin check', () => {
    mockState.pairing.source = 'qr';
    const walletKit = makeWalletKit();

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 14,
        pairingTopic: 'topic-qr',
        dappUrl: 'https://app.uniswap.org',
      }),
    );

    expect(walletKit.rejectSession).not.toHaveBeenCalled();
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 14, source: 'qr' }),
    );
    expect(emitWalletConnectUiEvent).not.toHaveBeenCalled();
  });

  it('still checks the origin for a second proposal on the same pairing topic', () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-reuse',
      'https://evil.example',
    );
    const walletKit = makeWalletKit();

    // the first proposal declares the real browser origin and passes through
    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 21,
        pairingTopic: 'topic-reuse',
        dappUrl: 'https://evil.example',
      }),
    );
    expect(storeWalletConnectProposal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 21 }),
    );
    expect(walletKit.rejectSession).not.toHaveBeenCalled();

    // a second proposal on the same pairing that spoofs a well-known dapp
    // is still rejected because the browser origin mapping is read-only
    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 22,
        pairingTopic: 'topic-reuse',
        dappUrl: 'https://app.uniswap.org',
      }),
    );
    expect(walletKit.rejectSession).toHaveBeenCalledWith({
      id: 22,
      reason: expect.objectContaining({ message: 'USER_REJECTED' }),
    });
    expect(jest.mocked(storeWalletConnectProposal).mock.calls.length).toBe(1);
    expect(emitWalletConnectUiEvent).toHaveBeenCalledWith({
      type: 'pairingError',
      message: 'page.walletConnect.pairingFailed',
    });
  });

  it('logs when rejecting a mismatched proposal fails', async () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-reject-fails',
      'https://evil.example',
    );
    const walletKit = {
      rejectSession: jest.fn().mockRejectedValue(new Error('relay down')),
    } as unknown as IWalletKit;

    handleWalletConnectSessionProposal(
      walletKit,
      makeProposalEvent({
        id: 15,
        pairingTopic: 'topic-reject-fails',
        dappUrl: 'https://app.uniswap.org',
      }),
    );
    await new Promise(resolve => setImmediate(resolve));

    expect(storeWalletConnectProposal).not.toHaveBeenCalled();
    expect(jest.mocked(addWalletConnectLog)).toHaveBeenCalledWith(
      'proposal',
      'failed to reject mismatched proposal',
      expect.any(Error),
      'error',
    );
    // the loading modal is still closed even when the reject call fails
    expect(emitWalletConnectUiEvent).toHaveBeenCalledWith({
      type: 'pairingError',
      message: 'page.walletConnect.pairingFailed',
    });
  });
});
