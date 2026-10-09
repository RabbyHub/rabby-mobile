import { pairWalletConnectUri } from '@/core/walletconnect';
import { Alert, Linking } from 'react-native';
import { checkShouldStartLoadingWithRequestForDappWebView } from './utils';

const mockWcUri =
  'wc:topic@2?relay-protocol=irn&symKey=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

jest.mock('@/core/walletconnect/uri', () => ({
  isRabbyWalletConnectDeeplink: jest.fn((url: string) =>
    url.startsWith('rabby://walletconnect'),
  ),
  parseWalletConnectUriFromLink: jest.fn(() => mockWcUri),
}));

jest.mock('@/core/walletconnect', () => ({
  pairWalletConnectUri: jest.fn(() => Promise.resolve()),
}));

describe('dapp WebView external navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires confirmation before opening a MetaMask deeplink', async () => {
    const url = 'metamask://wc?uri=example';

    expect(checkShouldStartLoadingWithRequestForDappWebView({ url })).toBe(
      false,
    );
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(pairWalletConnectUri).not.toHaveBeenCalled();

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    const allow = buttons?.find(button => button.text === 'Allow');
    expect(allow?.onPress).toBeDefined();
    await allow?.onPress?.();

    expect(Linking.canOpenURL).toHaveBeenCalledWith(url);
    expect(Linking.openURL).toHaveBeenCalledWith(url);
  });

  it('preserves automatic opening for raw WalletConnect links', async () => {
    expect(
      checkShouldStartLoadingWithRequestForDappWebView({ url: mockWcUri }),
    ).toBe(false);
    await Promise.resolve();

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(Linking.openURL).toHaveBeenCalledWith(mockWcUri);
    expect(pairWalletConnectUri).not.toHaveBeenCalled();
  });

  it.each([
    'https://app.example',
    'http://app.example',
    'about:blank',
    'blob:https://app.example/page',
  ])('allows ordinary navigation while inactive: %s', url => {
    expect(
      checkShouldStartLoadingWithRequestForDappWebView(
        { url },
        { canOpenExternalUrl: () => false },
      ),
    ).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(pairWalletConnectUri).not.toHaveBeenCalled();
  });

  it.each([
    'metamask://wc?uri=example',
    mockWcUri,
    'rabby://walletconnect?uri=wc',
  ])('blocks inactive external requests without any prompt: %s', url => {
    expect(
      checkShouldStartLoadingWithRequestForDappWebView(
        { url, sourceDocumentURL: 'https://app.example/page' },
        {
          enforceWalletConnectOrigin: true,
          canOpenExternalUrl: () => false,
        },
      ),
    ).toBe(false);

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(pairWalletConnectUri).not.toHaveBeenCalled();
  });

  it('does not open a confirmed link if the tab became inactive while the prompt was open', async () => {
    let isActive = true;
    checkShouldStartLoadingWithRequestForDappWebView(
      { url: 'metamask://wc?uri=example' },
      { canOpenExternalUrl: () => isActive },
    );

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    const allow = buttons?.find(button => button.text === 'Allow');
    expect(allow?.onPress).toBeDefined();
    isActive = false;
    await allow?.onPress?.();

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each(['metamask://wc?uri=example', mockWcUri])(
    'does not open a link if the tab becomes inactive during the native capability query: %s',
    async url => {
      let isActive = true;
      let resolveSupported!: (supported: boolean) => void;
      const supported = new Promise<boolean>(resolve => {
        resolveSupported = resolve;
      });
      jest.mocked(Linking.canOpenURL).mockReturnValueOnce(supported);
      checkShouldStartLoadingWithRequestForDappWebView(
        { url },
        { canOpenExternalUrl: () => isActive },
      );
      if (url.startsWith('metamask:')) {
        const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
        const allow = buttons?.find(button => button.text === 'Allow');
        expect(allow?.onPress).toBeDefined();
        allow?.onPress?.();
      }
      expect(Linking.canOpenURL).toHaveBeenCalledWith(url);

      isActive = false;
      resolveSupported(true);
      await supported;
      await Promise.resolve();

      expect(Linking.openURL).not.toHaveBeenCalled();
    },
  );

  it('does not open a MetaMask link when the warning is ignored', async () => {
    checkShouldStartLoadingWithRequestForDappWebView({
      url: 'metamask://wc?uri=example',
    });

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2];
    const ignore = buttons?.find(button => button.text === 'Ignore');
    expect(ignore?.onPress).toBeDefined();
    await ignore?.onPress?.();

    expect(Linking.canOpenURL).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
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
