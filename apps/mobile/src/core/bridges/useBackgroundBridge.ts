import React, { useCallback, useRef } from 'react';

import { atom, useAtom } from 'jotai';
import { BackgroundBridge } from './BackgroundBridge';
import { urlUtils } from '@rabby-wallet/base-utils';

const backgroundBridgesAtom = atom<BackgroundBridge[]>([]);

export function useBackgroundBridges() {
  const [backgroundBridges, setBackgroundBridges] = useAtom(
    backgroundBridgesAtom,
  );

  const backgroundBridgeRefs = useRef(backgroundBridges);

  const putBackgroundBridge = useCallback(
    (bridge: BackgroundBridge) => {
      setBackgroundBridges((prev: BackgroundBridge[]) => {
        prev.push(bridge);
        backgroundBridgeRefs.current = prev;

        return prev;
      });
    },
    [setBackgroundBridges],
  );

  const removeBackgroundBridge = useCallback(
    (bridge: BackgroundBridge) => {
      setBackgroundBridges((prev: BackgroundBridge[]) => {
        const idx = prev.indexOf(bridge);

        if (idx === -1) {
          return prev;
        }

        prev.splice(idx, 1);

        backgroundBridgeRefs.current = prev;

        return prev;
      });
    },
    [setBackgroundBridges],
  );

  const clearBackgroundBridges = useCallback(() => {
    setBackgroundBridges([]);
    backgroundBridgeRefs.current = [];
  }, [setBackgroundBridges]);

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

export function useSetupWebview({
  dappId,
  urlRef,
  webviewRef,
}: {
  dappId: string;
  urlRef: React.MutableRefObject<string>;
  webviewRef: React.MutableRefObject<WebView | null>;
}) {
  const { backgroundBridgeRefs, putBackgroundBridge, removeBackgroundBridge } =
    useBackgroundBridges();

  const initializeBackgroundBridge = (
    urlBridge: string,
    isMainFrame: boolean = true,
  ) => {
    const newBridge = new BackgroundBridge({
      webview: webviewRef,
      url: urlBridge,
      isMainFrame,
    });

    putBackgroundBridge(newBridge);
  };

  const onMessage: OnMessage = ({ nativeEvent }) => {
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
  };

  const onLoadStart: OnLoadStart = async ({ nativeEvent }) => {
    if (
      nativeEvent.url !== urlRef.current &&
      nativeEvent.loading &&
      nativeEvent.navigationType === 'backforward'
    ) {
      // changeAddressBar({ ...nativeEvent });
    }

    // setError(false);

    // changeUrl(nativeEvent);
    // sendActiveAccount();

    // icon.current = null;

    // Reset the previous bridges
    backgroundBridgeRefs.current.length &&
      backgroundBridgeRefs.current.forEach(bridge => bridge.onDisconnect());

    // // Cancel loading the page if we detect its a phishing page
    // const { hostname } = new URL(nativeEvent.url);
    // if (!isAllowedUrl(hostname)) {
    //   handleNotAllowedUrl(url);
    //   return false;
    // }

    backgroundBridgeRefs.current = [];
    const dappOrigin = urlUtils.canoicalizeDappUrl(dappId).httpOrigin;
    initializeBackgroundBridge(dappOrigin, true);
  };

  return {
    onLoadStart,
    onMessage,
  };
}
