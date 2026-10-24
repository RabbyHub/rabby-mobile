import { useEffect, type MutableRefObject } from 'react';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';

import {
  getActiveDappState,
  globalSetActiveDappState,
} from '@/core/bridges/state';

export const INNER_GLOBAL_TAB_ID = 'innerGlobalTabId';

/**
 * Publish this webview as the active dapp while it is active.
 *
 * @why the active dapp state is shared with the Browser and the Dapps screen,
 * and the RPC middleware checks it on every request. An inactive (hidden but
 * still mounted) webview must never write it, otherwise the visible Browser tab
 * looks inactive and its signing requests are rejected with "Not Allowed".
 */
export function useSyncActiveDappState({
  dappOrigin,
  webviewIdRef,
  offscreenPreload,
  webviewActive,
}: {
  dappOrigin: string;
  webviewIdRef: MutableRefObject<string>;
  offscreenPreload?: boolean;
  webviewActive: boolean;
}) {
  useEffect(() => {
    if (!webviewActive) {
      return;
    }

    const tabId = offscreenPreload ? INNER_GLOBAL_TAB_ID : webviewIdRef.current;
    const nextOrigin = safeGetOrigin(dappOrigin) || dappOrigin;

    const activeState = getActiveDappState();
    if (
      activeState.tabId !== tabId ||
      activeState.isScreenHide ||
      activeState.dappOrigin !== nextOrigin
    ) {
      globalSetActiveDappState({
        dappOrigin: nextOrigin,
        tabId,
        isScreenHide: false,
      });
    }

    return () => {
      // only hide the state we still own, another webview may have taken over
      const latestState = getActiveDappState();
      if (
        latestState.tabId === tabId &&
        latestState.dappOrigin === nextOrigin
      ) {
        globalSetActiveDappState({ isScreenHide: true });
      }
    };
  }, [dappOrigin, offscreenPreload, webviewActive, webviewIdRef]);
}
