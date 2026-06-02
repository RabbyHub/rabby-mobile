import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { isNonPublicProductionEnv } from '@/constant';
import { RABBY_MOBILE_WALLETCONNECT_PROJECT_ID } from '@/constant/env';
import { WALLETCONNECT_METADATA } from './constants';
import { addWalletConnectLog } from './debugLog';
import {
  clearWalletConnectProposal,
  storeWalletConnectProposal,
} from './proposal';
import { handleWalletConnectSessionRequest } from './requestBridge';
import {
  disconnectWalletConnectDappMirrorByTopic,
  forgetWalletConnectSession,
  syncWalletConnectSessionsFromClient,
} from './sessions';
import {
  getWalletConnectDebugState,
  setWalletConnectClientStatus,
  setWalletConnectDebugState,
} from './state';
import { walletConnectStorage } from './storage';

let walletKitClient: any = null;
let initPromise: Promise<any> | null = null;

function bindWalletConnectEvents(walletKit: any, core: any) {
  walletKit.on('session_proposal', (event: any) => {
    const source =
      getWalletConnectDebugState().pairing.source || ('manual' as const);
    storeWalletConnectProposal({
      id: event.id,
      proposal: event.params,
      source,
      verifyContext: event.verifyContext,
    });
  });

  walletKit.on('session_request', (event: any) => {
    handleWalletConnectSessionRequest({
      walletKit,
      event,
    });
  });

  walletKit.on('session_delete', (event: any) => {
    disconnectWalletConnectDappMirrorByTopic(event.topic);
    forgetWalletConnectSession(event.topic);
    syncWalletConnectSessionsFromClient(walletKit);
    addWalletConnectLog('sessions', 'session_delete received', event);
  });

  walletKit.on('proposal_expire', (event: any) => {
    clearWalletConnectProposal(event.id);
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error: 'WalletConnect proposal expired.',
      },
    }));
    addWalletConnectLog('proposal', 'proposal expired', event, 'warn');
  });

  walletKit.on('session_request_expire', (event: any) => {
    setWalletConnectDebugState(prev => ({
      ...prev,
      pendingRequests: prev.pendingRequests.filter(
        item => item.id !== event.id,
      ),
    }));
    addWalletConnectLog('request', 'session_request expired', event, 'warn');
  });

  core?.pairing?.events?.on?.('pairing_expire', (event: any) => {
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error: 'WalletConnect pairing expired. Refresh the dapp QR code.',
      },
    }));
    addWalletConnectLog('pairing', 'pairing expired', event, 'warn');
  });

  core?.relayer?.on?.('relayer_connect', () => {
    addWalletConnectLog('relay', 'relay connected');
  });
  core?.relayer?.on?.('relayer_disconnect', () => {
    addWalletConnectLog('relay', 'relay disconnected', undefined, 'warn');
  });
}

export async function initWalletConnectForTest() {
  if (!isNonPublicProductionEnv) {
    setWalletConnectClientStatus(
      'disabled',
      'WalletConnect test wallet is disabled in public production builds.',
    );
    throw new Error(
      'WalletConnect test wallet is disabled in public production builds.',
    );
  }

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
    syncWalletConnectSessionsFromClient(walletKit);
    setWalletConnectClientStatus('ready');
    addWalletConnectLog('client', 'WalletKit ready');
    return walletKit;
  })().catch(error => {
    initPromise = null;
    const message = error?.message || String(error);
    setWalletConnectClientStatus('error', message);
    addWalletConnectLog('client', 'WalletKit init failed', error, 'error');
    throw error;
  });

  return initPromise;
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
