import { initWalletConnect } from './client';
import { addWalletConnectLog } from './debugLog';
import { getWalletConnectErrorMessage } from './error';
import { setWalletConnectDebugState } from './state';
import type { WalletConnectPairingSource } from './types';
import { parseWalletConnectUri, WalletConnectUriError } from './uri';

function formatPairingError(error: unknown) {
  if (error instanceof WalletConnectUriError) {
    return error.message;
  }

  const message = getWalletConnectErrorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes('already') || lower.includes('duplicate')) {
    return 'This WalletConnect URI is already being paired. Refresh the dapp QR code and try again.';
  }
  if (lower.includes('expired')) {
    return 'WalletConnect pairing expired. Refresh the dapp QR code and try again.';
  }
  if (
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('socket') ||
    lower.includes('relay')
  ) {
    return 'WalletConnect relay is not reachable. Check the network and try again.';
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
    setWalletConnectDebugState(prev => {
      if (
        prev.pairing.status !== 'pairing' ||
        prev.pairing.uri !== parsed.uri
      ) {
        return prev;
      }

      return {
        ...prev,
        pairing: {
          ...prev.pairing,
          status: 'error',
          error: message,
        },
      };
    });
    addWalletConnectLog('pairing', 'pairing failed', error, 'error');
    throw new Error(message);
  }
}
