function loadBrowserModule() {
  jest.resetModules();

  jest.doMock('@/constant/browser', () => ({
    APP_STORE_URL_PREFIXES: ['itms-apps://', 'https://apps.apple.com'],
  }));

  jest.doMock('@rabby-wallet/base-utils', () => ({
    urlUtils: {
      safeParseURL: (input: string) => {
        try {
          return new URL(input);
        } catch (error) {
          return null;
        }
      },
    },
  }));

  jest.doMock('react-native-fs', () => ({
    DocumentDirectoryPath: '/documents',
  }));

  return require('./browser') as typeof import('./browser');
}

describe('browser utils', () => {
  it('getAddressBarTitle returns the google query for plain search terms and hostname otherwise', () => {
    const { getAddressBarTitle } = loadBrowserModule();

    expect(
      getAddressBarTitle('https://www.google.com/search?q=rabby%20wallet'),
    ).toBe('rabby wallet');
    expect(getAddressBarTitle('https://www.google.com/search?q=rabby.io')).toBe(
      'www.google.com',
    );
    expect(getAddressBarTitle('https://debank.com/account')).toBe('debank.com');
    expect(getAddressBarTitle('not-a-url')).toBe('not-a-url');
  });

  it('detects google hosts and app store urls', () => {
    const { isGoogle, isValidAppStoreUrl } = loadBrowserModule();

    expect(isGoogle('https://www.google.com/search?q=test')).toBe(true);
    expect(isGoogle('https://debank.com')).toBe(false);
    expect(isValidAppStoreUrl('itms-apps://itunes.apple.com/app/id1')).toBe(
      true,
    );
    expect(isValidAppStoreUrl('https://example.com/app')).toBe(false);
  });

  it('builds view-shot paths and preserves data uris', () => {
    const { getViewShotFilePath, getViewShotUri } = loadBrowserModule();

    expect(getViewShotFilePath('folder/capture.png')).toBe(
      '/documents/capture.png',
    );
    expect(getViewShotFilePath('data:image/png;base64,abc')).toBe('');
    expect(getViewShotUri('folder/capture.png')).toBe(
      'file:///documents/capture.png',
    );
    expect(getViewShotUri('data:image/png;base64,abc')).toBe(
      'data:image/png;base64,abc',
    );
  });
});
