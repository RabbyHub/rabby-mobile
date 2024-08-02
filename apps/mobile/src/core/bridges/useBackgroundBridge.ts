import React, { useState, useCallback, useRef } from 'react';
import { Alert } from 'react-native';

import { BackgroundBridge } from './BackgroundBridge';
import { urlUtils } from '@rabby-wallet/base-utils';
import type { WebViewNavigation } from 'react-native-webview';
import { dappService, sessionService } from '../services/shared';
import {
  allowLinkOpen,
  getAlertMessage,
  protocolAllowList,
  trustedProtocolToDeeplink,
} from '@/constant/dappView';
import { createDappBySession } from '../apis/dapp';

export function useBackgroundBridges() {
  const [, setSpinner] = useState(false);
  const backgroundBridgeRefs = useRef<BackgroundBridge[]>([]);

  const putBackgroundBridge = useCallback((bridge: BackgroundBridge) => {
    const prev = backgroundBridgeRefs.current;
    prev.push(bridge);

    backgroundBridgeRefs.current = prev;
    setSpinner(prev => !prev);
  }, []);

  const removeBackgroundBridge = useCallback((bridge: BackgroundBridge) => {
    const prev = backgroundBridgeRefs.current;
    const idx = prev.indexOf(bridge);

    if (idx === -1) {
      return prev;
    }

    prev.splice(idx, 1);

    backgroundBridgeRefs.current = prev;
  }, []);

  const clearBackgroundBridges = useCallback(() => {
    backgroundBridgeRefs.current = [];
    setSpinner(prev => !prev);
  }, []);

  return {
    backgroundBridgeRefs,
    putBackgroundBridge,
    removeBackgroundBridge,
    clearBackgroundBridges,
  };
}

type WebView = import('react-native-webview').WebView;
type OnLoadStart = import('react-native-webview').WebViewProps['onLoadStart'] &
  Function;
type OnMessage = import('react-native-webview').WebViewProps['onMessage'] &
  Function;

export type OnSelfClose = (reason: 'phishing') => void;

export function useSetupWebview({
  dappOrigin,
  siteInfoRefs: { urlRef, titleRef, iconRef },
  webviewRef,
  webviewIdRef,
}: // onSelfClose,
{
  dappOrigin: string;
  siteInfoRefs: {
    urlRef: React.MutableRefObject<string>;
    titleRef: React.MutableRefObject<string>;
    iconRef: React.MutableRefObject<string | undefined>;
  };
  webviewIdRef: React.MutableRefObject<string>;
  webviewRef: React.MutableRefObject<WebView | null>;
  // onSelfClose?: OnSelfClose;
}) {
  const { backgroundBridgeRefs, putBackgroundBridge, removeBackgroundBridge } =
    useBackgroundBridges();

  const initializeBackgroundBridge = useCallback(
    (urlBridge: string, isMainFrame: boolean = true) => {
      urlRef.current = urlBridge;
      const newBridge = new BackgroundBridge({
        webview: webviewRef,
        webviewIdRef: webviewIdRef,
        urlRef,
        titleRef,
        iconRef,
        isMainFrame,
      });

      const session = sessionService.getOrCreateSession(newBridge);
      session?.setProp({
        origin: urlBridge,
        icon: '//todo',
        name: '//todo',
      });

      if (!dappService.getDapp(urlBridge) && session) {
        dappService.addDapp(createDappBySession(session));
      }

      putBackgroundBridge(newBridge);
    },
    [iconRef, putBackgroundBridge, titleRef, urlRef, webviewRef, webviewIdRef],
  );

  const onMessage = useCallback(
    ({ nativeEvent }: Parameters<OnMessage>[0]) => {
      let data = nativeEvent.data as any;
      try {
        data = typeof data === 'string' ? JSON.parse(data) : data;
        if (!data || (!data.type && !data.name)) {
          return;
        }
        if (data.name) {
          const senderOrigin = urlUtils.canoicalizeDappUrl(
            nativeEvent.url,
          ).httpOrigin;

          backgroundBridgeRefs.current.forEach(bridge => {
            const bridgeOrigin = urlUtils.canoicalizeDappUrl(
              bridge.url,
            ).httpOrigin;

            if (bridgeOrigin === senderOrigin) {
              bridge.onMessage(data);
            }
          });
          return;
        }
      } catch (e) {
        console.error(e, `Browser::onMessage on ${urlRef.current}`);
      }
    },
    [backgroundBridgeRefs, urlRef],
  );

  const changeUrl = useCallback(
    async (navInfo: WebViewNavigation) => {
      urlRef.current = navInfo.url;
      titleRef.current = navInfo.title;
      // if (navInfo.icon) iconRef.current = navInfo.icon;
    },
    [urlRef, titleRef],
  );

  // would be called every time the url changes
  const onLoadStart: OnLoadStart = useCallback(
    async ({ nativeEvent }) => {
      if (
        nativeEvent.url !== urlRef.current &&
        nativeEvent.loading &&
        nativeEvent.navigationType === 'backforward'
      ) {
        // changeAddressBar({ ...nativeEvent });
      }

      // setError(false);

      changeUrl(nativeEvent);
      // sendActiveAccount();

      // icon.current = null;

      // Reset the previous bridges
      backgroundBridgeRefs.current.length &&
        backgroundBridgeRefs.current.forEach(bridge => {
          bridge.onDisconnect();
          sessionService.deleteSession(bridge);
        });

      // // Cancel loading the page if we detect its a phishing page
      // const { hostname } = new URL(nativeEvent.url);
      // if (!isAllowedUrl(hostname)) {
      //   handleNotAllowedUrl(url);
      //   return false;
      // }

      backgroundBridgeRefs.current = [];
      const formattedDappOrigin =
        urlUtils.canoicalizeDappUrl(dappOrigin).httpOrigin;
      initializeBackgroundBridge(formattedDappOrigin, true);
    },
    [
      backgroundBridgeRefs,
      changeUrl,
      dappOrigin,
      initializeBackgroundBridge,
      urlRef,
    ],
  );

  /**
   *  Function that allows custom handling of any web view requests.
   *  Return `true` to continue loading the request and `false` to stop loading.
   */
  const onShouldStartLoadWithRequest = useCallback(({ url }) => {
    const { protocol = '' } = urlUtils.safeParseURL(url) || {};
    // Continue request loading it the protocol is whitelisted
    if (protocolAllowList.includes(protocol)) return true;

    // If it is a trusted deeplink protocol, do not show the
    // warning alert. Allow the OS to deeplink the URL
    // and stop the webview from loading it.
    if (trustedProtocolToDeeplink.includes(protocol)) {
      allowLinkOpen(url);
      return false;
    }

    const alertMsg = getAlertMessage(protocol);

    // Pop up an alert dialog box to prompt the user for permission
    // to execute the request
    Alert.alert('Warning', alertMsg, [
      {
        text: 'Ignore',
        onPress: () => null,
        style: 'cancel',
      },
      {
        text: 'Allow',
        onPress: () => allowLinkOpen(url),
        style: 'default',
      },
    ]);

    return false;
  }, []);

  return {
    onLoadStart,
    onShouldStartLoadWithRequest,
    onMessage,
  };
}
