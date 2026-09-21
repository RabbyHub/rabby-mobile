import { addWalletConnectLog } from './debugLog';

const WALLETCONNECT_PENDING_REDIRECT_TTL_MS = 2 * 60 * 1000;

export type WalletConnectDappRedirectPendingSource =
  | 'pairing_deeplink'
  | 'metadata_redirect';

export type WalletConnectDappRedirectPending = {
  markedAt: number;
  source: WalletConnectDappRedirectPendingSource;
  ageMs: number;
};

let pendingRedirect: {
  markedAt: number;
  source: WalletConnectDappRedirectPendingSource;
} | null = null;

export function markWalletConnectDappRedirectPending(
  source: WalletConnectDappRedirectPendingSource = 'metadata_redirect',
) {
  pendingRedirect = {
    markedAt: Date.now(),
    source,
  };
  addWalletConnectLog('redirect', 'pending redirect marked', {
    source,
  });
}

export function clearWalletConnectDappRedirectPending(reason = 'cleared') {
  if (pendingRedirect) {
    addWalletConnectLog('redirect', 'pending redirect cleared', {
      source: pendingRedirect.source,
      ageMs: Date.now() - pendingRedirect.markedAt,
      reason,
    });
  }
  pendingRedirect = null;
}

export function consumeWalletConnectDappRedirectPending() {
  if (!pendingRedirect) {
    return null;
  }

  const now = Date.now();
  const ageMs = now - pendingRedirect.markedAt;
  const consumed = {
    ...pendingRedirect,
    ageMs,
  };
  pendingRedirect = null;

  if (ageMs > WALLETCONNECT_PENDING_REDIRECT_TTL_MS) {
    addWalletConnectLog('redirect', 'pending redirect expired', {
      source: consumed.source,
      ageMs,
    });
    return null;
  }

  addWalletConnectLog('redirect', 'pending redirect consumed', {
    source: consumed.source,
    ageMs,
  });
  return consumed;
}
