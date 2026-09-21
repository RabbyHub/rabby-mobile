import i18n from '@/utils/i18n';
import { initWalletConnect } from './client';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
import {
  forgetWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingTopicFromUri,
  rememberWalletConnectPairingBrowserOrigin,
} from './pairingBrowserOrigin';
import {
  clearWalletConnectDappRedirectPending,
  markWalletConnectDappRedirectPending,
} from './redirectState';
import { setWalletConnectDebugState } from './state';
import type { WalletConnectPairingSource } from './types';
import { emitWalletConnectUiEvent } from './uiEvents';
import { parseWalletConnectUri, WalletConnectUriError } from './uri';

function formatPairingError(error: unknown) {
  if (error instanceof WalletConnectUriError) {
    return error.message;
  }

  const message = getWalletConnectErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes('already') || lower.includes('duplicate')) {
    return i18n.t('page.walletConnect.duplicatePairing');
  }
  if (lower.includes('expired')) {
    return i18n.t('page.walletConnect.pairingExpired');
  }
  if (
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('socket') ||
    lower.includes('relay')
  ) {
    return i18n.t('page.walletConnect.relayUnreachable');
  }

  return message;
}

export async function pairWalletConnectUri(input: {
  uri: string;
  source: WalletConnectPairingSource;
  browserOrigin?: string;
}) {
  let parsed: ReturnType<typeof parseWalletConnectUri>;
  let browserPairingTopic: string | null = null;
  try {
    parsed = parseWalletConnectUri(input.uri);
    if (input.browserOrigin !== undefined) {
      const topic = getWalletConnectPairingTopicFromUri(parsed.uri);
      if (input.source !== 'inner-webview' || !topic) {
        throw new Error(i18n.t('page.walletConnect.pairingFailed'));
      }
      const didRememberOrigin = rememberWalletConnectPairingBrowserOrigin({
        topic,
        browserOrigin: input.browserOrigin,
      });
      if (!didRememberOrigin) {
        throw new Error(i18n.t('page.walletConnect.pairingFailed'));
      }
      browserPairingTopic = topic;
    }
  } catch (error) {
    const message = formatPairingError(error);
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
    throw error;
  }

  if (input.source === 'deeplink') {
    markWalletConnectDappRedirectPending('pairing_deeplink');
  } else {
    clearWalletConnectDappRedirectPending('new non-deeplink pairing');
  }

  setWalletConnectDebugState(prev => ({
    ...prev,
    pairing: {
      status: 'pairing',
      source: input.source,
      uri: parsed.uri,
      error: undefined,
    },
  }));
  emitWalletConnectUiEvent({
    type: 'pairingStarted',
  });
  addWalletConnectLog('pairing', 'pairing started', {
    source: input.source,
  });

  try {
    const walletKit = await initWalletConnect();
    await walletKit.pair({
      uri: parsed.uri,
    });
    addWalletConnectLog('pairing', 'pairing submitted');
  } catch (error) {
    if (browserPairingTopic) {
      forgetWalletConnectPairingBrowserOrigin(browserPairingTopic);
    }
    if (input.source === 'deeplink') {
      clearWalletConnectDappRedirectPending('pairing failed');
    }
    const message = formatPairingError(error);
    let didSetError = false;
    setWalletConnectDebugState(prev => {
      if (
        prev.pairing.status !== 'pairing' ||
        prev.pairing.uri !== parsed.uri
      ) {
        return prev;
      }

      didSetError = true;
      return {
        ...prev,
        pairing: {
          ...prev.pairing,
          status: 'error',
          error: message,
        },
      };
    });
    if (didSetError) {
      emitWalletConnectUiEvent({
        type: 'pairingError',
        message,
      });
    }
    addWalletConnectLog('pairing', 'pairing failed', error, 'error');
    throw new Error(message);
  }
}
