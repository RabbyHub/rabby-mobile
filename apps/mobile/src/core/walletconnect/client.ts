import type { IWalletKit, WalletKitTypes } from '@reown/walletkit';
import { getSdkError } from '@walletconnect/utils';
import i18n from '@/utils/i18n';
import { RABBY_MOBILE_WALLETCONNECT_PROJECT_ID } from '@/constant/env';
import {
  clearWalletConnectAutoDisconnectTopic,
  disconnectRestoredWalletConnectSessionsForAutoDisconnect,
} from './autoDisconnect';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
import { WALLETCONNECT_CLIENT_METADATA } from './metadata';
import {
  forgetWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingBrowserOrigin,
  isWalletConnectOriginMismatch,
} from './pairingBrowserOrigin';
import {
  clearWalletConnectProposal,
  storeWalletConnectProposal,
} from './proposal';
import { forgetWalletConnectAccountForTopic } from './accountPersistence';
import { clearWalletConnectDappRedirectPending } from './redirectState';
import { handleWalletConnectSessionRequest } from './requestBridge';
import { syncWalletConnectSessionsFromClient } from './sessions';
import {
  getWalletConnectDebugState,
  setWalletConnectClientStatus,
  setWalletConnectDebugState,
} from './state';
import { walletConnectStorage } from './storage';
import { emitWalletConnectUiEvent } from './uiEvents';
import { traceAndroidInstant } from '../utils/androidTrace';

type WalletConnectCore = InstanceType<
  typeof import('@walletconnect/core').Core
> & {
  pairing?: {
    events?: {
      on?: (
        event: 'pairing_expire' | 'pairing_delete',
        listener: (event: { topic: string }) => void,
      ) => void;
    };
  };
  relayer?: {
    on?: (
      event: 'relayer_connect' | 'relayer_disconnect',
      listener: () => void,
    ) => void;
  };
};

let walletKitClient: IWalletKit | null = null;
let initPromise: Promise<IWalletKit> | null = null;

async function rejectAndDisconnectWalletConnectPairing(
  walletKit: IWalletKit,
  event: WalletKitTypes.SessionProposal,
  pairingTopic: string,
) {
  try {
    await walletKit.rejectSession({
      id: event.id,
      reason: getSdkError('USER_REJECTED'),
    });
  } catch (error) {
    addWalletConnectLog(
      'proposal',
      'failed to reject origin-mismatched proposal',
      error,
      'error',
    );
  }

  try {
    await walletKit.core.pairing.disconnect({ topic: pairingTopic });
    forgetWalletConnectPairingBrowserOrigin(pairingTopic);
  } catch (error) {
    addWalletConnectLog(
      'pairing',
      'failed to disconnect origin-mismatched pairing',
      error,
      'error',
    );
  }
}

export function handleWalletConnectSessionProposal(
  walletKit: IWalletKit,
  event: WalletKitTypes.SessionProposal,
) {
  const pairingTopic = event.params?.pairingTopic;
  const browserOrigin = getWalletConnectPairingBrowserOrigin(pairingTopic);
  const source = browserOrigin
    ? 'inner-webview'
    : getWalletConnectDebugState().pairing.source || ('manual' as const);

  const dappUrl = event.params?.proposer?.metadata?.url;
  if (
    browserOrigin &&
    pairingTopic &&
    isWalletConnectOriginMismatch({
      browserOrigin,
      dappUrl,
    })
  ) {
    addWalletConnectLog(
      'proposal',
      'session proposal rejected: browser origin mismatch',
      { browserOrigin, dappUrl },
      'warn',
    );
    void rejectAndDisconnectWalletConnectPairing(
      walletKit,
      event,
      pairingTopic,
    );

    const message = i18n.t('page.walletConnect.pairingFailed');
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error: message,
      },
    }));
    emitWalletConnectUiEvent({
      type: 'pairingError',
      message,
    });
    return;
  }

  storeWalletConnectProposal({
    id: event.id,
    proposal: event.params,
    source,
    verifyContext: event.verifyContext,
  });
}

function bindWalletConnectEvents(
  walletKit: IWalletKit,
  core: WalletConnectCore,
) {
  walletKit.on('session_proposal', event => {
    handleWalletConnectSessionProposal(walletKit, event);
  });

  walletKit.on('session_request', event => {
    handleWalletConnectSessionRequest({
      walletKit,
      event,
    });
  });

  walletKit.on('session_delete', event => {
    clearWalletConnectAutoDisconnectTopic(event.topic);
    forgetWalletConnectAccountForTopic(event.topic);
    syncWalletConnectSessionsFromClient(walletKit);
    addWalletConnectLog('sessions', 'session_delete received', event);
  });

  walletKit.on('proposal_expire', event => {
    const currentProposalId = getWalletConnectDebugState().proposal?.id;
    clearWalletConnectProposal(event.id);
    clearWalletConnectDappRedirectPending();
    if (currentProposalId !== event.id) {
      addWalletConnectLog('proposal', 'stale proposal expired', event, 'warn');
      return;
    }

    const message = i18n.t('page.walletConnect.proposalExpired');
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error: message,
      },
    }));
    emitWalletConnectUiEvent({
      type: 'pairingError',
      message,
    });
    addWalletConnectLog('proposal', 'proposal expired', event, 'warn');
  });

  walletKit.on('session_request_expire', event => {
    addWalletConnectLog('request', 'session_request expired', event, 'warn');
  });

  core?.pairing?.events?.on?.('pairing_expire', event => {
    forgetWalletConnectPairingBrowserOrigin(event.topic);
    const pairingStatus = getWalletConnectDebugState().pairing.status;
    if (pairingStatus !== 'pairing') {
      addWalletConnectLog('pairing', 'stale pairing expired', event, 'warn');
      return;
    }

    const message = i18n.t('page.walletConnect.pairingExpired');
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error: message,
      },
    }));
    emitWalletConnectUiEvent({
      type: 'pairingError',
      message,
    });
    addWalletConnectLog('pairing', 'pairing expired', event, 'warn');
  });

  core?.relayer?.on?.('relayer_connect', () => {
    addWalletConnectLog('relay', 'relay connected');
  });
  core?.relayer?.on?.('relayer_disconnect', () => {
    addWalletConnectLog('relay', 'relay disconnected', undefined, 'warn');
  });
  core?.pairing?.events?.on?.('pairing_delete', event => {
    forgetWalletConnectPairingBrowserOrigin(event.topic);
  });
}

export async function initWalletConnect() {
  if (!RABBY_MOBILE_WALLETCONNECT_PROJECT_ID) {
    setWalletConnectClientStatus(
      'error',
      'Missing RABBY_MOBILE_WALLETCONNECT_PROJECT_ID.',
    );
    throw new Error('Missing RABBY_MOBILE_WALLETCONNECT_PROJECT_ID.');
  }

  if (walletKitClient) {
    return walletKitClient;
  }

  if (initPromise) {
    return initPromise;
  }

  setWalletConnectClientStatus('initializing');
  addWalletConnectLog('client', 'initializing WalletKit');

  initPromise = (async () => {
    const [{ Core }, { WalletKit }] = await Promise.all([
      import('@walletconnect/core'),
      import('@reown/walletkit'),
    ]);
    const core = new Core({
      projectId: RABBY_MOBILE_WALLETCONNECT_PROJECT_ID,
      storage: walletConnectStorage,
    });
    const walletKit = await WalletKit.init({
      core,
      metadata: WALLETCONNECT_CLIENT_METADATA,
    });

    walletKitClient = walletKit;
    bindWalletConnectEvents(walletKit, core);
    await disconnectRestoredWalletConnectSessionsForAutoDisconnect(walletKit);
    syncWalletConnectSessionsFromClient(walletKit);
    setWalletConnectClientStatus('ready');
    addWalletConnectLog('client', 'WalletKit ready');
    return walletKit;
  })().catch((error: unknown) => {
    initPromise = null;
    const message = getWalletConnectErrorMessage(error);
    setWalletConnectClientStatus('error', message);
    addWalletConnectLog('client', 'WalletKit init failed', error, 'error');
    throw error;
  });

  return initPromise;
}

export function startRestoreWalletConnectSessions() {
  if (!RABBY_MOBILE_WALLETCONNECT_PROJECT_ID) {
    traceAndroidInstant('global_task.walletconnect_restore.skipped', {
      reason: 'missing_project_id',
    });
    return;
  }

  traceAndroidInstant('global_task.walletconnect_restore.start', {
    hasInitPromise: Boolean(initPromise),
    hasClient: Boolean(walletKitClient),
  });
  initWalletConnect().catch((error: unknown) => {
    traceAndroidInstant('global_task.walletconnect_restore.error', {
      error: getWalletConnectErrorMessage(error),
    });
    console.warn('startRestoreWalletConnectSessions::error', error);
  });
  traceAndroidInstant('global_task.walletconnect_restore.end');
}

export function getWalletConnectClient() {
  return walletKitClient;
}

export function getWalletConnectClientOrThrow() {
  if (!walletKitClient) {
    throw new Error('WalletConnect client is not initialized.');
  }
  return walletKitClient;
}
