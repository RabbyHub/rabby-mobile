import { safeParseURL } from '@rabby-wallet/base-utils/dist/isomorphic/url';

export function getWalletConnectTelemetrySource(input: {
  url?: string | null;
  nativeRedirect?: string | null;
}) {
  const url = safeParseURL(input.url || '');
  const nativeRedirect = safeParseURL(input.nativeRedirect || '');

  return {
    dappOrigin: url?.origin === 'null' ? '' : url?.origin || '',
    appScheme:
      nativeRedirect?.protocol || (url?.origin === 'null' ? url.protocol : ''),
  };
}
