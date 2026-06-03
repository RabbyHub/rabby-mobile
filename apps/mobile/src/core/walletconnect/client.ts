import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import type { IWalletKit } from '@reown/walletkit';
import i18n from '@/utils/i18n';
import { RABBY_MOBILE_WALLETCONNECT_PROJECT_ID } from '@/constant/env';
import {
  clearWalletConnectAutoDisconnectTopic,
  disconnectRestoredWalletConnectSessionsForAutoDisconnect,
} from './autoDisconnect';
import { WALLETCONNECT_METADATA } from './constants';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
import {
  clearWalletConnectProposal,
  storeWalletConnectProposal,
} from './proposal';
import { handleWalletConnectSessionRequest } from './requestBridge';
import { syncWalletConnectSessionsFromClient } from './sessions';
import {
  getWalletConnectDebugState,
  setWalletConnectClientStatus,
  setWalletConnectDebugState,
} from './state';
import { walletConnectStorage } from './storage';
import { emitWalletConnectUiEvent } from './uiEvents';

type WalletConnectCore = InstanceType<typeof Core> & {
  pairing?: {
    events?: {
      on?: (
        event: 'pairing_expire',
        listener: (event: unknown) => void,
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

function bindWalletConnectEvents(
  walletKit: IWalletKit,
  core: WalletConnectCore,
) {
  walletKit.on('session_proposal', event => {
    const source =
      getWalletConnectDebugState().pairing.source || ('manual' as const);
    storeWalletConnectProposal({
      id: event.id,
      proposal: event.params,
      source,
      verifyContext: event.verifyContext,
    });
  });

  walletKit.on('session_request', event => {
    handleWalletConnectSessionRequest({
      walletKit,
      event,
    });
  });

  walletKit.on('session_delete', event => {
    clearWalletConnectAutoDisconnectTopic(event.topic);
    syncWalletConnectSessionsFromClient(walletKit);
    addWalletConnectLog('sessions', 'session_delete received', event);
  });

  walletKit.on('proposal_expire', event => {
    const currentProposalId = getWalletConnectDebugState().proposal?.id;
    clearWalletConnectProposal(event.id);
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
    const core = new Core({
      projectId: RABBY_MOBILE_WALLETCONNECT_PROJECT_ID,
      storage: walletConnectStorage,
    });
    const walletKit = await WalletKit.init({
      core,
      metadata: WALLETCONNECT_METADATA,
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
    return;
  }

  initWalletConnect().catch((error: unknown) => {
    console.warn('startRestoreWalletConnectSessions::error', error);
  });
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
