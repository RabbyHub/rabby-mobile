import { initWalletConnectForTest } from './client';
import { addWalletConnectLog } from './debugLog';
import {
  getWalletConnectDebugState,
  setWalletConnectDebugState,
} from './state';
import type { WalletConnectPairingSource } from './types';
import { parseWalletConnectUri, WalletConnectUriError } from './uri';

let pairingInFlightUri: string | null = null;

function formatPairingError(error: any) {
  if (error instanceof WalletConnectUriError) {
    return error.message;
  }

  const message = error?.message || String(error);
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
  const currentPairing = getWalletConnectDebugState().pairing;
  if (
    pairingInFlightUri ||
    currentPairing.status === 'validating' ||
    currentPairing.status === 'pairing'
  ) {
    const error =
      pairingInFlightUri === input.uri || currentPairing.uri === input.uri
        ? 'This WalletConnect URI is already being paired. Refresh the dapp QR code and try again.'
        : 'Another WalletConnect pairing is already in progress.';
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'error',
        error,
      },
    }));
    throw new Error(error);
  }

  setWalletConnectDebugState(prev => ({
    ...prev,
    pairing: {
      status: 'validating',
      source: input.source,
      uri: input.uri,
      error: undefined,
    },
  }));

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
  const walletKit = await initWalletConnectForTest();
  pairingInFlightUri = parsed.uri;
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
    await walletKit.pair({
      uri: parsed.uri,
    });
    setWalletConnectDebugState(prev => ({
      ...prev,
      pairing: {
        ...prev.pairing,
        status: 'paired',
        error: undefined,
      },
    }));
    addWalletConnectLog('pairing', 'pairing submitted');
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
    addWalletConnectLog('pairing', 'pairing failed', error, 'error');
    throw new Error(message);
  } finally {
    if (pairingInFlightUri === parsed.uri) {
      pairingInFlightUri = null;
    }
  }
}
