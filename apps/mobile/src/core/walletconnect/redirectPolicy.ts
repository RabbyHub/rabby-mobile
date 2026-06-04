import { Linking } from 'react-native';
import { addWalletConnectLog } from './debugLog';
import type { WalletConnectPairingSource } from './types';

export function shouldAutoRedirectToDapp(source: WalletConnectPairingSource) {
  return source === 'deeplink';
}

export async function maybeRedirectToDapp(input: {
  source: WalletConnectPairingSource;
  nativeRedirect?: string;
}) {
  if (
    !shouldAutoRedirectToDapp(input.source) ||
    !input.nativeRedirect?.trim()
  ) {
    return false;
  }

  try {
    await Linking.openURL(input.nativeRedirect);
    addWalletConnectLog('redirect', 'opened dapp redirect', {
      redirect: input.nativeRedirect,
    });
    return true;
  } catch (e) {
    addWalletConnectLog('redirect', 'failed to open dapp redirect', e, 'warn');
    return false;
  }
}
