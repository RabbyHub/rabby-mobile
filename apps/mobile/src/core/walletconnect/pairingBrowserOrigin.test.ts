import {
  getWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingTopicFromUri,
  getWalletConnectRegisteredDomain,
  isWalletConnectOriginMismatch,
  rememberWalletConnectPairingBrowserOrigin,
} from './pairingBrowserOrigin';

const WC_URI =
  'wc:topic-abc@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('getWalletConnectPairingTopicFromUri', () => {
  it('extracts the topic from a wc URI', () => {
    expect(getWalletConnectPairingTopicFromUri(WC_URI)).toBe('topic-abc');
    expect(getWalletConnectPairingTopicFromUri(`  ${WC_URI}  `)).toBe(
      'topic-abc',
    );
  });

  it('returns null for non-wc URIs', () => {
    expect(getWalletConnectPairingTopicFromUri('')).toBeNull();
    expect(
      getWalletConnectPairingTopicFromUri('https://example.com'),
    ).toBeNull();
    expect(
      getWalletConnectPairingTopicFromUri('wc:topic-abc@1?bridge=x'),
    ).toBeNull();
  });
});

describe('pairing browser origin map', () => {
  it('returns the remembered origin on repeated reads until the TTL expires', () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-read',
      'https://app.uniswap.org',
      1000,
    );
    expect(getWalletConnectPairingBrowserOrigin('topic-read', 1001)).toBe(
      'https://app.uniswap.org',
    );
    // non-destructive: a second proposal on the same pairing can still read it
    expect(getWalletConnectPairingBrowserOrigin('topic-read', 1002)).toBe(
      'https://app.uniswap.org',
    );
    expect(
      getWalletConnectPairingBrowserOrigin(
        'topic-read',
        1000 + 10 * 60 * 1000 + 1,
      ),
    ).toBeNull();
  });

  it('returns null for unknown or empty topics', () => {
    expect(getWalletConnectPairingBrowserOrigin('topic-missing')).toBeNull();
    expect(getWalletConnectPairingBrowserOrigin(undefined)).toBeNull();
    expect(getWalletConnectPairingBrowserOrigin('')).toBeNull();
  });

  it('expires entries after the TTL', () => {
    rememberWalletConnectPairingBrowserOrigin(
      'topic-expired',
      'https://evil.example',
      1000,
    );
    expect(
      getWalletConnectPairingBrowserOrigin(
        'topic-expired',
        1000 + 10 * 60 * 1000 + 1,
      ),
    ).toBeNull();
  });

  it('evicts the oldest entries beyond capacity', () => {
    const now = 1_000_000;
    for (let i = 0; i < 60; i++) {
      rememberWalletConnectPairingBrowserOrigin(
        `topic-cap-${i}`,
        `https://dapp-${i}.example`,
        now + i,
      );
    }
    // capacity is 50, so the first 10 entries are evicted
    expect(
      getWalletConnectPairingBrowserOrigin('topic-cap-0', now + 61),
    ).toBeNull();
    expect(
      getWalletConnectPairingBrowserOrigin('topic-cap-9', now + 61),
    ).toBeNull();
    expect(getWalletConnectPairingBrowserOrigin('topic-cap-10', now + 61)).toBe(
      'https://dapp-10.example',
    );
    expect(getWalletConnectPairingBrowserOrigin('topic-cap-59', now + 61)).toBe(
      'https://dapp-59.example',
    );
  });
});

describe('getWalletConnectRegisteredDomain', () => {
  it('returns the eTLD+1 for hosts with subdomains', () => {
    expect(getWalletConnectRegisteredDomain('https://app.uniswap.org')).toBe(
      'uniswap.org',
    );
    expect(getWalletConnectRegisteredDomain('https://uniswap.org/swap')).toBe(
      'uniswap.org',
    );
    expect(getWalletConnectRegisteredDomain('https://app.foo.co.uk')).toBe(
      'foo.co.uk',
    );
  });

  it('falls back to the hostname for hosts without a registrable domain', () => {
    expect(getWalletConnectRegisteredDomain('http://localhost:8545')).toBe(
      'localhost',
    );
    expect(getWalletConnectRegisteredDomain('http://192.168.1.1:8080')).toBe(
      '192.168.1.1',
    );
  });

  it('returns null for unparseable input', () => {
    expect(getWalletConnectRegisteredDomain('')).toBeNull();
    expect(getWalletConnectRegisteredDomain('not a url')).toBeNull();
  });
});

describe('isWalletConnectOriginMismatch', () => {
  it('treats same eTLD+1 as a match', () => {
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://app.uniswap.org',
        dappUrl: 'https://uniswap.org',
      }),
    ).toBe(false);
  });

  it('flags different eTLD+1 as a mismatch', () => {
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://evil.example',
        dappUrl: 'https://app.uniswap.org',
      }),
    ).toBe(true);
  });

  it('does not flag when either side is missing or unparseable', () => {
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: null,
        dappUrl: 'https://app.uniswap.org',
      }),
    ).toBe(false);
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://evil.example',
        dappUrl: '',
      }),
    ).toBe(false);
  });
});
