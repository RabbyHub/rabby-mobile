import { Linking } from 'react-native';
import RNHelpers from '@/core/native/RNHelpers';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { addWalletConnectLog } from './debugLog';
import { consumeWalletConnectDappRedirectPending } from './redirectState';
import type { WalletConnectPairingSource } from './types';
import { emitWalletConnectUiEvent } from './uiEvents';

type WalletConnectRedirectToast = {
  variant: 'success' | 'error';
  message: string;
};

export function shouldAutoRedirectToDapp(source: WalletConnectPairingSource) {
  return source === 'deeplink';
}

export async function maybeRedirectToDapp(input: {
  source?: WalletConnectPairingSource;
  nativeRedirect?: string;
  iosNoRedirectToast?: WalletConnectRedirectToast;
}) {
  const emitIosNoRedirectToast = () => {
    if (!IS_IOS || !input.iosNoRedirectToast) {
      return;
    }

    emitWalletConnectUiEvent({
      type: 'toast',
      ...input.iosNoRedirectToast,
    });
  };
  const pendingRedirect = consumeWalletConnectDappRedirectPending();
  const redirectReason = pendingRedirect
    ? 'pending_redirect'
    : input.source && shouldAutoRedirectToDapp(input.source)
    ? 'pairing_source'
    : undefined;
  const shouldRedirect =
    !!pendingRedirect ||
    (input.source ? shouldAutoRedirectToDapp(input.source) : false);

  if (!shouldRedirect) {
    return false;
  }

  if (IS_ANDROID) {
    try {
      const didMove = await RNHelpers.moveTaskToBack();
      addWalletConnectLog('redirect', 'moved Android task to back', {
        didMove,
        reason: redirectReason,
        pendingSource: pendingRedirect?.source,
        pairingSource: input.source,
      });
      if (didMove) {
        return true;
      }
    } catch (e) {
      addWalletConnectLog(
        'redirect',
        'failed to move Android task to back',
        e,
        'warn',
      );
    }
  }

  const nativeRedirect = input.nativeRedirect?.trim();
  if (!nativeRedirect) {
    emitIosNoRedirectToast();
    return false;
  }

  try {
    await Linking.openURL(nativeRedirect);
    addWalletConnectLog('redirect', 'opened dapp redirect', {
      redirect: nativeRedirect,
      reason: redirectReason,
      pendingSource: pendingRedirect?.source,
      pairingSource: input.source,
    });
    return true;
  } catch (e) {
    addWalletConnectLog('redirect', 'failed to open dapp redirect', e, 'warn');
    emitIosNoRedirectToast();
    return false;
  }
}
