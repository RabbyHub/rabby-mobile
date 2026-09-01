import { safeParseURL } from '@rabby-wallet/base-utils/dist/isomorphic/url';

const PAIRING_BROWSER_ORIGIN_TTL_MS = 10 * 60 * 1000;
const PAIRING_BROWSER_ORIGIN_MAX_ENTRIES = 50;

type PairingBrowserOriginEntry = {
  browserOrigin: string;
  createdAt: number;
};

const pairingBrowserOrigins = new Map<string, PairingBrowserOriginEntry>();

export function getWalletConnectPairingTopicFromUri(uri: string) {
  const match = /^wc:([^@]+)@2\?/i.exec((uri || '').trim());
  return match?.[1] || null;
}

function prunePairingBrowserOrigins(now: number) {
  for (const [topic, entry] of pairingBrowserOrigins) {
    if (now - entry.createdAt > PAIRING_BROWSER_ORIGIN_TTL_MS) {
      pairingBrowserOrigins.delete(topic);
    }
  }
  while (pairingBrowserOrigins.size >= PAIRING_BROWSER_ORIGIN_MAX_ENTRIES) {
    const oldestTopic = pairingBrowserOrigins.keys().next().value;
    if (oldestTopic === undefined) {
      break;
    }
    pairingBrowserOrigins.delete(oldestTopic);
  }
}

export function rememberWalletConnectPairingBrowserOrigin(
  topic: string,
  browserOrigin: string,
  now: number = Date.now(),
) {
  if (!topic || !browserOrigin) {
    return;
  }
  prunePairingBrowserOrigins(now);
  pairingBrowserOrigins.delete(topic);
  pairingBrowserOrigins.set(topic, { browserOrigin, createdAt: now });
}

export function getWalletConnectPairingBrowserOrigin(
  topic: string | undefined,
  now: number = Date.now(),
) {
  if (!topic) {
    return null;
  }
  const entry = pairingBrowserOrigins.get(topic);
  if (!entry || now - entry.createdAt > PAIRING_BROWSER_ORIGIN_TTL_MS) {
    return null;
  }
  return entry.browserOrigin;
}

export function getWalletConnectHostname(urlOrOrigin: string) {
  const urlInfo = safeParseURL(urlOrOrigin);
  const hostname = urlInfo?.hostname?.toLowerCase() || '';
  return hostname || null;
}

export function isWalletConnectOriginMismatch(input: {
  browserOrigin?: string | null;
  dappUrl?: string | null;
}) {
  const browserHostname = input.browserOrigin
    ? getWalletConnectHostname(input.browserOrigin)
    : null;
  const dappHostname = input.dappUrl
    ? getWalletConnectHostname(input.dappUrl)
    : null;
  if (!browserHostname || !dappHostname) {
    return false;
  }
  return browserHostname !== dappHostname;
}
