import {
  forgetWalletConnectPairingBrowserOrigin,
  getWalletConnectPairingBrowserOrigin,
  isWalletConnectOriginMismatch,
  rememberWalletConnectPairingBrowserOrigin,
} from './pairingBrowserOrigin';

const trackedTopics = new Set<string>();

function remember(topic: string, browserOrigin = 'https://app.example') {
  trackedTopics.add(topic);
  return rememberWalletConnectPairingBrowserOrigin({
    topic,
    browserOrigin,
  });
}

afterEach(() => {
  for (const topic of trackedTopics) {
    forgetWalletConnectPairingBrowserOrigin(topic);
  }
  trackedTopics.clear();
});

describe('walletconnect pairing browser origin', () => {
  it('compares the complete normalized origin', () => {
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://APP.example:443/path',
        dappUrl: 'https://app.example/another-path',
      }),
    ).toBe(false);
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://app.example',
        dappUrl: 'http://app.example',
      }),
    ).toBe(true);
    expect(
      isWalletConnectOriginMismatch({
        browserOrigin: 'https://app.example',
        dappUrl: 'not-a-url',
      }),
    ).toBe(true);
  });

  it('refuses to overwrite an existing topic binding', () => {
    expect(remember('immutable-topic')).toBe(true);
    expect(remember('immutable-topic', 'https://other.example')).toBe(false);
    expect(getWalletConnectPairingBrowserOrigin('immutable-topic')).toBe(
      'https://app.example',
    );
  });

  it('fails closed at capacity instead of evicting an existing binding', () => {
    for (let index = 0; index < 50; index += 1) {
      expect(remember(`capacity-topic-${index}`)).toBe(true);
    }

    expect(remember('capacity-overflow')).toBe(false);
    expect(getWalletConnectPairingBrowserOrigin('capacity-topic-0')).toBe(
      'https://app.example',
    );
  });
});
