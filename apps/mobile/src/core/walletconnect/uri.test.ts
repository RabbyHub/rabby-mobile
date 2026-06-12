import { parseWalletConnectUri, parseWalletConnectUriFromLink } from './uri';

const WC_URI =
  'wc:abc123@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('walletconnect uri', () => {
  it('accepts raw wc uri', () => {
    expect(parseWalletConnectUri(WC_URI).uri).toBe(WC_URI);
  });

  it('extracts encoded uri params from deep links', () => {
    const link = `rabby://walletconnect?uri=${encodeURIComponent(WC_URI)}`;
    expect(parseWalletConnectUri(link).uri).toBe(WC_URI);
    expect(parseWalletConnectUriFromLink(link)).toBe(WC_URI);
  });

  it('rejects empty and malformed input', () => {
    expect(() => parseWalletConnectUri('')).toThrow(
      'WalletConnect URI cannot be empty.',
    );
    expect(() => parseWalletConnectUri('https://rabby.io')).toThrow(
      'WalletConnect URI must start with wc:<topic>@2.',
    );
    expect(() =>
      parseWalletConnectUri('wc:abc123@2?relay-protocol=irn'),
    ).toThrow('WalletConnect URI is missing symKey or relay-protocol.');
  });
});
