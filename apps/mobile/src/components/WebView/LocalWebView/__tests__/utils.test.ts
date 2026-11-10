import { Platform } from 'react-native';

import {
  formatDevURI,
  getBaseURL,
  getLocalWebViewDefaultProps,
  makeRuntimeInfo,
  sendMessageToWebview,
} from '../utils';

jest.mock('@/utils/i18n', () => ({
  SupportedLang: {
    'en-US': 'en-US',
    'zh-CN': 'zh-CN',
  },
}));

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('LocalWebView utils', () => {
  describe('formatDevURI and getBaseURL', () => {
    it('formats development resource URLs with protocol, host, port and path', () => {
      expect(
        formatDevURI({
          host: 'localhost',
          port: 3000,
          path: 'assets/index.html',
        }),
      ).toBe('http://localhost:3000/assets/index.html');

      expect(
        formatDevURI({
          protocol: 'https:',
          host: 'rabby.io',
          path: '/mobile',
        }),
      ).toBe('https://rabby.io/mobile');
    });

    it('extracts a normalized base URL or returns undefined for invalid URLs', () => {
      expect(getBaseURL('http://localhost:3000/assets/index.html?x=1')).toBe(
        'http://localhost:3000/',
      );
      expect(getBaseURL('https://rabby.io/mobile')).toBe('https://rabby.io/');
      expect(getBaseURL('not a url')).toBeUndefined();
    });
  });

  it('builds platform-specific default WebView props from the same base flags', () => {
    const { iosWebViewProps, androidWebViewProps } =
      getLocalWebViewDefaultProps();

    expect(iosWebViewProps).toMatchObject({
      javaScriptEnabled: true,
      domStorageEnabled: true,
      originWhitelist: ['*'],
      scrollEnabled: false,
      cacheEnabled: false,
      incognito: true,
      allowsInlineMediaPlayback: true,
    });
    expect(androidWebViewProps).toMatchObject({
      javaScriptEnabled: true,
      domStorageEnabled: true,
      originWhitelist: ['*'],
      scrollEnabled: false,
      nestedScrollEnabled: true,
      allowFileAccess: true,
    });
  });

  it('creates runtime info with platform, theme, language and resource mode', () => {
    expect(
      makeRuntimeInfo({
        baseUrl: 'http://localhost:3000/',
        useDevResource: false,
        isDark: true,
        language: 'zh-CN' as any,
        i18nTexts: { hello: 'hello' },
        backGroundColor: '#000000',
      }),
    ).toEqual({
      runtimeBaseUrl: 'http://localhost:3000/',
      platform: Platform.OS,
      useDevResource: false,
      isDark: true,
      language: 'zh-CN',
      i18nTexts: { hello: 'hello' },
      backGroundColor: '#000000',
    });
  });

  describe('sendMessageToWebview', () => {
    it('warns and returns when webview is missing', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());

      sendMessageToWebview(null, { type: 'ping' });

      expect(warnSpy).toHaveBeenCalledWith(
        'sendMessageToWebview: webview is null',
      );
      warnSpy.mockRestore();
    });

    it('injects object messages as escaped CustomEvent detail payloads', () => {
      const webview = {
        injectJavaScript: jest.fn(),
      } as any;

      sendMessageToWebview(webview, {
        type: 'quote',
        text: "Rabby's \\\\ path",
      });

      const script = webview.injectJavaScript.mock.calls[0][0];
      expect(script).toContain("CustomEvent('messageFromRN'");
      expect(script).toContain('"type":"quote"');
      expect(script).toContain("Rabby\\'s");
      expect(script).toContain('true;');
    });

    it('allows string messages to be injected as raw JavaScript expressions', () => {
      const webview = {
        injectJavaScript: jest.fn(),
      } as any;

      sendMessageToWebview(webview, 'window.__RABBY_MESSAGE__');

      expect(webview.injectJavaScript.mock.calls[0][0]).toContain(
        'detail: window.__RABBY_MESSAGE__',
      );
    });
  });
});
