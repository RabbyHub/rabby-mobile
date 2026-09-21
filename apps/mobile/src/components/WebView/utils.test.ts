import { pairWalletConnectUri } from '@/core/walletconnect';
import { checkShouldStartLoadingWithRequestForDappWebView } from './utils';

const mockWcUri =
  'wc:topic@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

jest.mock('@/constant/dappView', () => ({
  allowLinkOpen: jest.fn(),
  getAlertMessage: jest.fn(() => ({ needAlert: false, allowOpenLink: false })),
  protocolAllowList: ['http:', 'https:'],
  trustedProtocolToDeeplink: ['wc:'],
}));

jest.mock('@/core/walletconnect/uri', () => ({
  isRabbyWalletConnectDeeplink: jest.fn((url: string) =>
    url.startsWith('rabby://walletconnect'),
  ),
  parseWalletConnectUriFromLink: jest.fn(() => mockWcUri),
}));

jest.mock('@/core/walletconnect', () => ({
  pairWalletConnectUri: jest.fn(() => Promise.resolve()),
}));

describe('dapp WebView WalletConnect deeplinks', () => {
  beforeEach(() => {
    jest.mocked(pairWalletConnectUri).mockClear();
  });

  it('ignores strict WalletConnect deeplinks without a source document', () => {
    checkShouldStartLoadingWithRequestForDappWebView(
      {
        url: 'rabby://walletconnect?uri=wc',
      },
      { enforceWalletConnectOrigin: true },
    );

    expect(pairWalletConnectUri).not.toHaveBeenCalled();
  });

  it('uses the native source document for a strict top-frame deeplink', () => {
    checkShouldStartLoadingWithRequestForDappWebView(
      {
        url: 'rabby://walletconnect?uri=wc',
        sourceDocumentURL: 'https://app.example/page',
      },
      { enforceWalletConnectOrigin: true },
    );

    expect(pairWalletConnectUri).toHaveBeenCalledWith({
      uri: mockWcUri,
      source: 'inner-webview',
      browserOrigin: 'https://app.example/page',
    });
  });

  it('preserves legacy handling when strict checking is not enabled', () => {
    checkShouldStartLoadingWithRequestForDappWebView({
      url: 'rabby://walletconnect?uri=wc',
    });

    expect(pairWalletConnectUri).toHaveBeenCalledWith({
      uri: mockWcUri,
      source: 'inner-webview',
      browserOrigin: undefined,
    });
  });
});
