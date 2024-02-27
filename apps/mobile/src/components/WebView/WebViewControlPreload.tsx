import { useCallback } from 'react';
import { Platform } from 'react-native';
import { atom, useAtom } from 'jotai';
import WebView, { WebViewProps } from 'react-native-webview';

import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { devLog } from '@/utils/logger';
import { StyleSheet } from 'react-native';
import DappWebViewControl from './DappWebViewControl';

const isAndroid = Platform.OS === 'android';

const TOUCH_HTML = `
<html>
<head>
</head>
<body>
  <div>touche view</div>
  <script>
    window.ethereum.request({ method: 'eth_accounts' });
  </script>
</body>
</html>
`;

const firstTouchedAtom = atom(!isAndroid);
/**
 * @description set this component on the top level of App's navigation context
 * to trigger inPageWeb3 script passed to `injectedJavaScriptBeforeContentLoaded` property
 * of react-native-webview
 * @platform android
 */
export default function WebViewControlPreload() {
  const [firstTouched, setFirstTouched] = useAtom(firstTouchedAtom);

  const { entryScriptWeb3Loaded } = useJavaScriptBeforeContentLoaded({
    isTop: false,
  });

  // devLog(
  //   '[debug] entryScriptWeb3Loaded, firstTouched',
  //   entryScriptWeb3Loaded,
  //   firstTouched,
  // );

  const onWebViewLoadEnd = useCallback<
    WebViewProps['onLoadEnd'] & object
  >(() => {
    setTimeout(() => {
      devLog('[WebViewControlPreload] webview loadEnd, will close it');
      setFirstTouched(true);
    }, 500);
  }, [setFirstTouched]);

  // const
  if (!isAndroid) return null;

  if (firstTouched) return null;

  if (!entryScriptWeb3Loaded) return null;

  return (
    <DappWebViewControl
      // would be ignored, just for type checking
      dappOrigin="https://rabby.io/docs/privacy"
      embedHtml={TOUCH_HTML}
      style={styles.webviewStyle}
      webviewProps={{
        cacheEnabled: false,
        onLoadEnd: onWebViewLoadEnd,
      }}
    />
    // <WebView
    //   cacheEnabled={false}
    //   startInLoadingState
    //   style={styles.webviewStyle}
    //   source={{
    //     // html: TOUCH_HTML,
    //     uri: 'https://rabby.io/docs/privacy',
    //   }}
    //   injectedJavaScriptBeforeContentLoaded={fullScript}
    //   injectedJavaScriptBeforeContentLoadedForMainFrameOnly={true}
    //   onError={error => {
    //     // TODO: report to sentry
    //     devLog('WebViewControlPreload webview error', error);
    //   }}
    //   webviewDebuggingEnabled={__DEV__}
    //   onMessage={event => {
    //     devLog('WebView:: onMessage event', event);
    //   }}
    //   onLoadEnd={onWebViewLoadEnd}
    // />
  );
}

const styles = StyleSheet.create({
  webviewStyle: {
    display: 'none',
    height: 0,
    width: 0,
    position: 'absolute',
    bottom: -999,
  },
});
