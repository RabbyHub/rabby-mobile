import { shouldAutoRedirectToDapp } from './redirectPolicy';

jest.mock('./debugLog', () => ({
  addWalletConnectLog: jest.fn(),
}));

jest.mock('react-native', () => ({
  Linking: {
    openURL: jest.fn(),
  },
}));

describe('walletconnect redirect policy', () => {
  it('only auto redirects deep-link initiated connections', () => {
    expect(shouldAutoRedirectToDapp('deeplink')).toBe(true);
    expect(shouldAutoRedirectToDapp('qr')).toBe(false);
    expect(shouldAutoRedirectToDapp('manual')).toBe(false);
  });
});
