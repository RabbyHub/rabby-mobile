import React from 'react';
import { cleanup, render } from '@testing-library/react-native';
import type { WebViewProps } from 'react-native-webview';

// Component-unit coverage: render the real source/grant assembly and asset
// helpers; replace scene hooks and the native WebView boundary only. Native
// file permissions and WKWebView URL conversion still need device coverage.
const mockWebViewProps = jest.fn();
let mockPlatform: 'ios' | 'android' = 'ios';
let mockMainBundlePath =
  '/private/var/containers/Bundle/Application/UUID/Rabby.app';
let mockDevHost = '127.0.0.1';
let mockDevAvailable = true;

jest.mock('@/core/native/utils', () => ({
  get IS_ANDROID() {
    return mockPlatform === 'android';
  },
  get IS_IOS() {
    return mockPlatform === 'ios';
  },
}));

jest.mock('@rabby-wallet/react-native-fs', () => ({
  get MainBundlePath() {
    return mockMainBundlePath;
  },
}));

jest.mock('@/hooks/theme', () => ({
  useTheme2024: () => ({ styles: { webView: {} }, isLight: true }),
}));
jest.mock('@/utils/styles', () => ({
  createGetStyles2024: (getStyle: unknown) => getStyle,
}));
jest.mock('@/hooks/lang', () => ({
  useAppLanguage: () => ({ currentLanguage: 'en-US' }),
}));
jest.mock('@/utils/i18n', () => ({
  SupportedLang: { 'en-US': 'en-US' },
}));
jest.mock('@/core/utils/devServerSettings', () => ({
  useDevServerHostAvailableForLocalWebView: ({
    devUri,
  }: {
    devUri: (context: { devServerHost: string }) => string;
  }) => ({
    devServerHost: mockDevHost,
    devServerMobileLocalPagesAvailable: mockDevAvailable,
    devUri: devUri({ devServerHost: mockDevHost }),
  }),
}));

jest.mock('react-native-webview', () => {
  const ReactModule = require('react');
  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      (props: WebViewProps, ref: React.Ref<unknown>) => {
        ReactModule.useImperativeHandle(ref, () => ({
          injectJavaScript: jest.fn(),
        }));
        mockWebViewProps(props);
        return null;
      },
    ),
  };
});

type Component = typeof import('../LocalWebView').LocalWebView;

function loadComponent() {
  let component!: Component;
  // The platform and bundle path are module constants in the real asset
  // helper. Reload that graph for each native environment, retaining the
  // renderer's React instance so hooks are exercised normally.
  jest.doMock('react', () => React);
  jest.isolateModules(() => {
    component = require('../LocalWebView').LocalWebView;
  });
  return component;
}

function nativeProps(): WebViewProps {
  expect(mockWebViewProps).toHaveBeenCalled();
  return mockWebViewProps.mock.calls.at(-1)![0];
}

const initialDev = __DEV__;
const normalBundlePath =
  '/private/var/containers/Bundle/Application/UUID/Rabby.app';
const entryPath = '/pages/tradingview-candle-chart.html';

describe('LocalWebView native source and read grant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform = 'ios';
    mockMainBundlePath = normalBundlePath;
    mockDevHost = '127.0.0.1';
    mockDevAvailable = true;
    (global as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  });

  afterEach(() => {
    cleanup();
    (global as typeof globalThis & { __DEV__: boolean }).__DEV__ = initialDev;
  });

  it.each([
    normalBundlePath,
    `${normalBundlePath}/`,
    '/private/var/containers/Bundle/Application/UUID/Rabby QA #1 中文?.app',
  ])(
    'keeps the production iOS document inside its exact read grant: %s',
    bundlePath => {
      mockMainBundlePath = bundlePath;
      const LocalWebView = loadComponent();

      render(<LocalWebView entryPath={entryPath} />);

      const props = nativeProps();
      const bundleRoot = bundlePath.endsWith('/')
        ? bundlePath
        : `${bundlePath}/`;
      const readRoot = `${bundleRoot}builtin-pages/`;
      // RCTConvert NSURL: accepts an absolute filesystem path and converts it
      // with fileURLWithPath. Do not URL-parse this raw path: #/? are filenames.
      expect(props.allowingReadAccessToURL).toBe(readRoot);
      expect(props.source).toMatchObject({
        uri: `${readRoot}pages/tradingview-candle-chart.html`,
        baseUrl: bundleRoot,
      });
      const source = props.source as { uri: string };
      expect(source.uri.startsWith(props.allowingReadAccessToURL!)).toBe(true);
      expect(source.uri).not.toContain('//');
    },
  );

  it('keeps the Android bundled asset URL and does not grant an iOS file scope', () => {
    mockPlatform = 'android';
    const LocalWebView = loadComponent();

    render(<LocalWebView entryPath={entryPath} />);

    expect(nativeProps()).toMatchObject({
      source: {
        uri: 'file:///android_asset/custom/builtin-pages/pages/tradingview-candle-chart.html',
        baseUrl: 'file:///android_asset/custom/',
      },
      allowingReadAccessToURL: undefined,
    });
  });

  it.each(['ios', 'android'] as const)(
    'keeps the %s development server source when it is reachable',
    platform => {
      mockPlatform = platform;
      (global as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
      const LocalWebView = loadComponent();

      render(<LocalWebView entryPath={entryPath} />);

      expect(nativeProps().source).toMatchObject({
        uri: 'http://127.0.0.1:5173/pages/tradingview-candle-chart.html',
        baseUrl: 'http://127.0.0.1:5173/',
      });
    },
  );
});
