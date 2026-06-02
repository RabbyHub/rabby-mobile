import { getSdkError } from '@walletconnect/utils';
import type { Account } from '@/types/account';
import {
  getWalletConnectClientOrThrow,
  initWalletConnectForTest,
} from './client';
import { addWalletConnectLog } from './debugLog';
import { pairWalletConnectUri } from './pairing';
import {
  buildApprovedNamespacesForAccount,
  clearWalletConnectProposal,
  getWalletConnectPendingProposal,
  setWalletConnectProposalError,
} from './proposal';
import { maybeRedirectToDapp } from './redirectPolicy';
import {
  disconnectWalletConnectDappMirror,
  ensureWalletConnectDappMirror,
  forgetWalletConnectSession,
  getWalletConnectSession,
  rememberWalletConnectSession,
  syncWalletConnectSessionsFromClient,
} from './sessions';

export { initWalletConnectForTest, pairWalletConnectUri };
export {
  getWalletConnectDebugState,
  subscribeWalletConnectDebugState,
} from './state';
export {
  parseWalletConnectUri,
  parseWalletConnectUriFromLink,
  isWalletConnectUri,
  WalletConnectUriError,
} from './uri';
export {
  getWalletConnectChainByCaip2,
  getWalletConnectSupportedChains,
  getWalletConnectAccounts,
} from './chainAccount';
export { shouldAutoRedirectToDapp } from './redirectPolicy';
export { respondSessionRequestOnce } from './requestResponse';
export type {
  WalletConnectDebugState,
  WalletConnectPairingSource,
} from './types';

function getSdkErrorCompat(key: string) {
  return getSdkError(key as any);
}

export async function approveWalletConnectProposal(input: {
  proposalId: number;
  account: Account;
}) {
  const walletKit = getWalletConnectClientOrThrow();
  const pending = getWalletConnectPendingProposal(input.proposalId);
  if (!pending) {
    throw new Error('WalletConnect proposal not found or already handled.');
  }

  let namespaces: any;
  try {
    namespaces = buildApprovedNamespacesForAccount({
      proposal: pending.proposal,
      account: input.account,
    });
  } catch (error: any) {
    const message = error?.message || String(error);
    setWalletConnectProposalError(input.proposalId, message);
    addWalletConnectLog(
      'proposal',
      'failed to build approved namespaces',
      error,
      'error',
    );
    try {
      const sdkErrorKey = /method/i.test(message)
        ? 'UNSUPPORTED_METHODS'
        : 'UNSUPPORTED_CHAINS';
      await walletKit.rejectSession({
        id: input.proposalId,
        reason: getSdkErrorCompat(sdkErrorKey),
      });
      clearWalletConnectProposal(input.proposalId);
    } catch (rejectError) {
      addWalletConnectLog(
        'proposal',
        'failed to reject invalid proposal',
        rejectError,
        'error',
      );
    }
    throw error;
  }

  try {
    const session = await walletKit.approveSession({
      id: input.proposalId,
      namespaces,
    });
    rememberWalletConnectSession({
      topic: session.topic,
      account: input.account,
      source: pending.source,
    });
    ensureWalletConnectDappMirror({
      session,
      account: input.account,
    });
    clearWalletConnectProposal(input.proposalId);
    syncWalletConnectSessionsFromClient(walletKit);
    addWalletConnectLog('proposal', 'session approved', {
      id: input.proposalId,
      topic: session.topic,
      source: pending.source,
    });
    await maybeRedirectToDapp({
      source: pending.source,
      nativeRedirect: session.peer?.metadata?.redirect?.native,
    });
  } catch (error: any) {
    const message = error?.message || String(error);
    setWalletConnectProposalError(input.proposalId, message);
    addWalletConnectLog('proposal', 'approveSession failed', error, 'error');
    throw error;
  }
}

export async function rejectWalletConnectProposal(proposalId: number) {
  const walletKit = getWalletConnectClientOrThrow();
  await walletKit.rejectSession({
    id: proposalId,
    reason: getSdkErrorCompat('USER_REJECTED'),
  });
  clearWalletConnectProposal(proposalId);
  addWalletConnectLog('proposal', 'session proposal rejected', { proposalId });
}

export async function disconnectWalletConnectSession(topic: string) {
  const walletKit = getWalletConnectClientOrThrow();
  const session = getWalletConnectSession(walletKit, topic);
  if (session) {
    disconnectWalletConnectDappMirror(session);
  }
  await walletKit.disconnectSession({
    topic,
    reason: getSdkErrorCompat('USER_DISCONNECTED'),
  });
  forgetWalletConnectSession(topic);
  syncWalletConnectSessionsFromClient(walletKit);
  addWalletConnectLog('sessions', 'session disconnected by wallet', { topic });
}

export async function refreshWalletConnectSessionsForTest() {
  const walletKit = await initWalletConnectForTest();
  syncWalletConnectSessionsFromClient(walletKit);
}
