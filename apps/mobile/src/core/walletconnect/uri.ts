import i18n from '@/utils/i18n';

export type WalletConnectUriParseErrorCode =
  | 'EMPTY_URI'
  | 'INVALID_URI'
  | 'INVALID_WC_URI';

export class WalletConnectUriError extends Error {
  code: WalletConnectUriParseErrorCode;

  constructor(code: WalletConnectUriParseErrorCode, message: string) {
    super(message);
    this.name = 'WalletConnectUriError';
    this.code = code;
  }
}

export type ParsedWalletConnectUri = {
  uri: string;
  raw: string;
};

function safeDecode(input: string) {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function normalizeCandidate(input: string) {
  let candidate = input.trim();
  for (let i = 0; i < 2; i++) {
    const decoded = safeDecode(candidate);
    if (decoded === candidate) {
      break;
    }
    candidate = decoded.trim();
  }
  return candidate;
}

function getUriParam(input: string) {
  try {
    const url = new URL(input);
    const value = url.searchParams.get('uri');
    return value ? normalizeCandidate(value) : null;
  } catch {
    return null;
  }
}

export function isWalletConnectUri(uri: string) {
  return /^wc:[^@]+@2\?/i.test(uri.trim());
}

function validateWalletConnectUri(uri: string) {
  if (!isWalletConnectUri(uri)) {
    throw new WalletConnectUriError(
      'INVALID_WC_URI',
      i18n.t('page.walletConnect.uriInvalidFormat'),
    );
  }

  const queryIndex = uri.indexOf('?');
  const query = queryIndex >= 0 ? uri.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  if (!params.get('symKey') || !params.get('relay-protocol')) {
    throw new WalletConnectUriError(
      'INVALID_WC_URI',
      i18n.t('page.walletConnect.uriMissingParams'),
    );
  }
}

export function parseWalletConnectUri(input: string): ParsedWalletConnectUri {
  const raw = input || '';
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new WalletConnectUriError(
      'EMPTY_URI',
      i18n.t('page.walletConnect.uriEmpty'),
    );
  }

  const uriFromParam = getUriParam(trimmed);
  const normalized = uriFromParam ? uriFromParam : normalizeCandidate(trimmed);
  const uri = uriFromParam || normalized;

  validateWalletConnectUri(uri);
  return {
    raw,
    uri,
  };
}

export function parseWalletConnectUriFromLink(appLink: string) {
  try {
    return parseWalletConnectUri(appLink).uri;
  } catch {
    return null;
  }
}
