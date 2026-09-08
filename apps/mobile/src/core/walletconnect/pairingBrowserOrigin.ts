import { safeParseURL } from '@rabby-wallet/base-utils/dist/isomorphic/url';

const PAIRING_BROWSER_ORIGIN_MAX_ENTRIES = 50;

const pairingBrowserOrigins = new Map<string, string>();

export function getWalletConnectPairingTopicFromUri(uri: string) {
  const match = /^wc:([^@]+)@2\?/i.exec(uri.trim());
  return match?.[1] || null;
}

function normalizeWalletConnectOrigin(urlOrOrigin: string) {
  const url = safeParseURL(urlOrOrigin);
  if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return null;
  }
  return url.origin;
}

export function rememberWalletConnectPairingBrowserOrigin(input: {
  topic: string;
  browserOrigin: string;
}) {
  const origin = normalizeWalletConnectOrigin(input.browserOrigin);
  if (!input.topic || !origin) {
    return false;
  }

  if (
    pairingBrowserOrigins.has(input.topic) ||
    pairingBrowserOrigins.size >= PAIRING_BROWSER_ORIGIN_MAX_ENTRIES
  ) {
    return false;
  }

  pairingBrowserOrigins.set(input.topic, origin);
  return true;
}

export function getWalletConnectPairingBrowserOrigin(
  topic: string | undefined,
) {
  return topic ? pairingBrowserOrigins.get(topic) || null : null;
}

export function forgetWalletConnectPairingBrowserOrigin(topic: string) {
  pairingBrowserOrigins.delete(topic);
}

export function isWalletConnectOriginMismatch(input: {
  browserOrigin: string;
  dappUrl?: string | null;
}) {
  const browserOrigin = normalizeWalletConnectOrigin(input.browserOrigin);
  if (!browserOrigin) {
    return true;
  }

  const declaredOrigin = input.dappUrl
    ? normalizeWalletConnectOrigin(input.dappUrl)
    : null;
  return browserOrigin !== declaredOrigin;
}
