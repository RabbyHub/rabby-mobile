import React, { useCallback, useRef, useEffect } from 'react';

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
import { useRefState } from '@/hooks/common/useRefState';

export const BLANK_PAGE = 'about:blank';
export const BLANK_RABBY_PAGE = 'about:rabby';
export const BUILTIN_SPECIAL_URLS = [BLANK_PAGE, BLANK_RABBY_PAGE];

type WebView = import('react-native-webview').WebView;
type OnLoadStart = (
  event: Parameters<
    import('react-native-webview').WebViewProps['onLoadStart'] & Function
  >[0],
  treatAsReload?: boolean,
) => void;
type OnMessage = import('react-native-webview').WebViewProps['onMessage'] &
  Function;

export type OnSelfClose = (reason: 'phishing') => void;

export function useSetupWebview({
  siteInfoRefs: { urlRef, titleRef, iconRef },
  webviewRef,
  webviewIdRef,
}: {
  /** @deprecated */
  dappOrigin?: string;
  siteInfoRefs: {
    urlRef: React.MutableRefObject<string>;
    titleRef: React.MutableRefObject<string>;
    iconRef: React.MutableRefObject<string | undefined>;
  };
  webviewIdRef: React.MutableRefObject<string>;
  webviewRef: React.MutableRefObject<WebView | null>;
}) {
  const { setRefState: putBackgroundBridge, stateRef: currentBridgeRef } =
    useRefState<BackgroundBridge | null>(null);

  const destroyCurrentBridge = useCallback(() => {
    if (currentBridgeRef.current) {
      currentBridgeRef.current.onDisconnect();
      sessionService.deleteSession(currentBridgeRef.current);
      currentBridgeRef.current = null;
    }
  }, [currentBridgeRef]);

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
        icon: '',
        name: titleRef.current,
      });

      if (!dappService.getDapp(urlBridge) && session) {
        dappService.addDapp(createDappBySession(session));
      }

      putBackgroundBridge(newBridge, true);
    },
    [urlRef, webviewRef, webviewIdRef, titleRef, iconRef, putBackgroundBridge],
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
          currentBridgeRef.current?.onMessage(data);
          return;
        }
      } catch (e) {
        console.error(e, `Browser::onMessage on ${urlRef.current}`);
      }
    },
    [currentBridgeRef, urlRef],
  );

  const changeUrl = useCallback(
    async (navInfo: WebViewNavigation) => {
      urlRef.current = navInfo.url;
      titleRef.current = navInfo.title;
      // if (navInfo.icon) iconRef.current = navInfo.icon;
    },
    [urlRef, titleRef],
  );

  const onReloadingRef = useRef<boolean>(false);
  // would be called every time the url changes
  const onLoadStart: OnLoadStart = useCallback(
    async ({ nativeEvent }, treatAsReload = false) => {
      if (onReloadingRef.current) return;
      onReloadingRef.current = treatAsReload;

      try {
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

        if (treatAsReload) {
          destroyCurrentBridge();

          // // Cancel loading the page if we detect its a phishing page
          // const { hostname } = new URL(nativeEvent.url);
          // if (!isAllowedUrl(hostname)) {
          //   handleNotAllowedUrl(url);
          //   return false;
          // }

          const dappOrigin = nativeEvent.url;
          putBackgroundBridge(null, false);
          const formattedDappOrigin = BUILTIN_SPECIAL_URLS.includes(dappOrigin)
            ? dappOrigin
            : urlUtils.canoicalizeDappUrl(dappOrigin).httpOrigin;
          initializeBackgroundBridge(formattedDappOrigin, true);
        }
      } catch (e: any) {
        console.error('useSetupWebview::onLoadStart::', e);
      } finally {
        onReloadingRef.current = false;
      }
    },
    [
      destroyCurrentBridge,
      changeUrl,
      initializeBackgroundBridge,
      urlRef,
      putBackgroundBridge,
    ],
  );

  useEffect(() => {
    return () => {
      destroyCurrentBridge();
    };
  }, [destroyCurrentBridge]);

  return {
    onLoadStart,
    onMessage,
  };
}
