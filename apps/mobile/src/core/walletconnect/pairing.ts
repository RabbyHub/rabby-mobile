import i18n from '@/utils/i18n';
import { initWalletConnect } from './client';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
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
}) {
  let parsed: ReturnType<typeof parseWalletConnectUri>;
  try {
    parsed = parseWalletConnectUri(input.uri);
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
