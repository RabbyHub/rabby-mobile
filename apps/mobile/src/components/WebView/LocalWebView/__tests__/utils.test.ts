import { runInNewContext } from 'node:vm';
import { Platform } from 'react-native';
import type WebView from 'react-native-webview';

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
      allowFileAccessFromFileURLs: true,
      allowUniversalAccessFromFileURLs: false,
    });
    expect(androidWebViewProps).toMatchObject({
      javaScriptEnabled: true,
      domStorageEnabled: true,
      originWhitelist: ['*'],
      scrollEnabled: false,
      nestedScrollEnabled: true,
      allowFileAccess: false,
      allowFileAccessFromFileURLs: true,
      allowUniversalAccessFromFileURLs: false,
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

    function deliverMessage(message: unknown) {
      const dispatchEvent = jest.fn();
      const window = { dispatchEvent, __injected: false };
      const injectJavaScript = jest.fn((script: string) => {
        runInNewContext(script, {
          window,
          CustomEvent: class {
            constructor(
              public type: string,
              public options: {
                detail: unknown;
                bubbles: boolean;
                cancelable: boolean;
              },
            ) {}
          },
        });
      });

      sendMessageToWebview({ injectJavaScript } as unknown as WebView, message);

      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      expect(window.__injected).toBe(false);
      const event = dispatchEvent.mock.calls[0][0];
      expect(event.type).toBe('messageFromRN');
      expect(event.options).toMatchObject({ bubbles: true, cancelable: true });
      return event.options.detail;
    }

    it('round-trips nested data with quotes, slashes, apostrophes and line separators', () => {
      const message = {
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          proConfig: {
            baseAsset: 'Rabby\'s "quoted" \\ path\n\u2028\u2029',
          },
          values: [null, true, 42, '中文'],
        },
      };

      expect(deliverMessage(message)).toEqual(message);
    });

    it('does not execute a display label that could escape the old JSON expression', () => {
      const message = {
        type: 'TRADINGVIEW_MESSAGE',
        data: {
          type: 'SET_CANDLESTICK_DATA',
          proConfig: {
            baseAsset: '"}}}, injected: (window.__injected = true), //',
          },
        },
      };

      expect(deliverMessage(message)).toEqual(message);
    });

    it('treats string messages as data instead of JavaScript expressions', () => {
      const message = '(window.__injected = true)';

      expect(deliverMessage(message)).toBe(message);
    });

    it('preserves __proto__ as an own data property without changing the prototype', () => {
      const message = JSON.parse('{"__proto__":{"injected":true}}');
      const detail = deliverMessage(message);

      expect(detail).toEqual(message);
      expect(Object.prototype.hasOwnProperty.call(detail, '__proto__')).toBe(
        true,
      );
      expect(detail.injected).toBeUndefined();
    });

    it.each([null, undefined, true, 42])(
      'preserves primitive message %p',
      message => {
        expect(deliverMessage(message)).toBe(message);
      },
    );
  });
});
