import { useCallback, useMemo } from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';
import { atom, useAtom } from 'jotai';
import WebView, { WebViewProps } from 'react-native-webview';

import { useJavaScriptBeforeContentLoaded } from '@/hooks/useBootstrap';
import { devLog } from '@/utils/logger';
import DappWebViewControl from './DappWebViewControl';
import { SELF_CHECK_RPC_METHOD } from '@/constant/rpc';
import { makeDebugBorder } from '@/utils/styles';
import { BLANK_RABBY_PAGE } from './hooks';

const isAndroid = Platform.OS === 'android';

function getTouchHtml(inPageScript: string = '') {
  return `
  <html>
  <head>
    <!-- touch view -->
    <title></title>
  </head>
  <body>
    <div style="display: none;">touch view</div>
    <script>
      ;(function() {
        ${inPageScript}
      })();

      ;(function() {
        // ${
          __DEV__
            ? `!window.ethereum && window.alert('window.ethereum not exist, type: ' + Object.keys(window).sort());`
            : ''
        }
        window.ReactNativeWebView.postMessage(JSON.stringify({
          name: 'rabby-provider',
          data: {
            method: '${SELF_CHECK_RPC_METHOD}',
            jsonrpc: '2.0',
            id: '-999',
            params: [],
            toNative: true,
          },
          origin: '${BLANK_RABBY_PAGE}',
        }));
      })();
    </script>
    <script>
    </script>
  </body>
  </html>
  `;
}

const firstTouchedAtom = atom(!isAndroid);
/**
 * @deprecated
 * @description set this component on the top level of App's navigation context
 * to trigger inPageWeb3 script passed to `injectedJavaScriptBeforeContentLoaded` property
 * of react-native-webview
 * @platform android
 */
export default function WebViewControlPreload() {
  const [firstTouched, setFirstTouched] = useAtom(firstTouchedAtom);

  const { entryScriptWeb3Loaded, entryScripts } =
    useJavaScriptBeforeContentLoaded();

  // devLog(
  //   '[debug] entryScriptWeb3Loaded, firstTouched',
  //   entryScriptWeb3Loaded,
  //   firstTouched,
  // );

  const onWebViewLoadEnd = useCallback<
    WebViewProps['onLoadEnd'] & object
  >(() => {
    devLog('[WebViewControlPreload] webview loadEnd, will force close it');
    setTimeout(() => {
      setFirstTouched(true);
      devLog('[WebViewControlPreload] webview loadEnd, force closed it');
    }, 500);
  }, [setFirstTouched]);

  const embedHtml = useMemo(() => {
    return getTouchHtml(entryScripts.inPageWeb3);
  }, [entryScripts.inPageWeb3]);

  // const
  if (!isAndroid) return null;

  if (firstTouched) return null;

  if (!entryScriptWeb3Loaded) return null;

  return (
    <DappWebViewControl
      // would be ignored, just for type checking
      key={'internal-webview-control-preload'}
      dappOrigin={BLANK_RABBY_PAGE}
      initialUrl={BLANK_RABBY_PAGE}
      embedHtml={embedHtml}
      style={StyleSheet.flatten([
        styles.webviewStyle,
        // __DEV__ && styles.debugStyle,
      ])}
      webviewProps={{
        cacheEnabled: false,
        onError: e => {
          if (__DEV__) {
            devLog('[WebViewControlPreload] webview error', e);
          }
        },
        onLoadEnd: onWebViewLoadEnd,
      }}
    />
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
  debugStyle: {
    ...makeDebugBorder('red'),
    display: 'flex',
    padding: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: Dimensions.get('window').height - 60,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    position: 'absolute',
    top: 60,
    bottom: 0,
  },
});
