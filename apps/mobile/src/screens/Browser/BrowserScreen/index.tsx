import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { AccountSwitcherModalInDappWebView } from '@/components/AccountSwitcher/Modal';
import { globalSetActiveDappState } from '@/core/bridges/state';
import { IS_ANDROID } from '@/core/native/utils';
import { browserService, preferenceService } from '@/core/services';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useSyncDappsInfo } from '@/hooks/useSyncDappsInfo';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { View } from 'react-native';
import { BrowserRef, BrowserTab } from './components/BrowserTab';
import { useFocusEffect } from '@react-navigation/native';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { BrowserManage } from './components/BrowserManage';
import { BrowserSearchResult } from './components/BrowserSearch/BrowserSearchResult';
import { BrowserSearch } from './components/BrowserSearch';

export function BrowserScreen() {
  const { styles: stylesScreen } = useTheme2024({
    getStyle: getScreenStyle,
  });

  const { safeTop, androidOnlyBottomOffset } = useSafeSizes();

  const activeDappWebViewControlRef = useRef<BrowserRef | null>(null);

  const {
    tabs,
    displayedTabs,
    activeTabId,
    closeTab,
    updateTab,
    openTab,
    browserState,
    setBrowserState,
    setPartialBrowserState,
  } = useBrowser();

  const activeTabOrigin = useMemo(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) {
      return safeGetOrigin(tab.url);
    }
    return undefined;
  }, [tabs, activeTabId]);

  const { setBrowserHistory } = useBrowserHistory();

  useLayoutEffect(() => {
    console.debug('BrowserScreen mounted');
    preferenceService.toggleAllowNotifyAccountsChanged(true);
    return () => {
      preferenceService.toggleAllowNotifyAccountsChanged(false);
      console.debug('BrowserScreen unmounted 1');
    };
  }, []);

  useSyncDappsInfo();

  // useFocusEffect(
  //   useCallback(() => {
  //     globalSetActiveDappState({
  //       isScreenHide: false,
  //     });
  //     return () => {
  //       globalSetActiveDappState({
  //         isScreenHide: true,
  //       });
  //     };
  //   }, []),
  // );

  useEffect(() => {
    globalSetActiveDappState({
      isScreenHide: !browserState.isShowBrowser,
    });
  }, [browserState.isShowBrowser]);

  return (
    <View
      style={[
        stylesScreen.container,
        {
          paddingBottom: androidOnlyBottomOffset,
        },
      ]}>
      <>
        {tabs.map((tab, idx) => {
          const isActiveTab = activeTabId === tab.id;
          const key = tab.id;
          const urlInfo = urlUtils.canoicalizeDappUrl(
            tab.initialUrl || tab.url,
          );

          if (tab.isTerminate && !isActiveTab) {
            return null;
          }

          return (
            <BrowserTab
              key={key}
              ref={inst => {
                if (isActiveTab) {
                  globalSetActiveDappState({ dappOrigin: urlInfo.origin });
                  activeDappWebViewControlRef.current = inst;
                  globalSetActiveDappState({
                    dappOrigin: urlInfo.origin,
                    tabId: tab.id,
                  });
                }
              }}
              isActive={isActiveTab}
              onUpdateTab={params => {
                updateTab(tab.id, params);
              }}
              onUpdateHistory={({ url, name }) => {
                setBrowserHistory({
                  url,
                  name,
                  createdAt: Date.now(),
                });
              }}
              onOpenTab={openTab}
              style={[!isActiveTab && { display: 'none' }]}
              origin={urlInfo.origin}
              tabId={tab.id}
              url={tab.initialUrl}
              tabsCount={displayedTabs.length}
              onSelfClose={reason => {
                if (reason === 'phishing') {
                  // todo
                  closeTab(tab.id);
                }
              }}
              onCloseTab={() => {
                if (tabs.length === 1) {
                  setPartialBrowserState({
                    isShowBrowser: false,
                  });
                }
                closeTab(tab.id);
              }}
              // webviewContainerMaxHeight={webviewMaxHeight}
              webviewProps={{
                /**
                 * @platform ios
                 */
                contentMode: 'mobile',
                /**
                 * set nestedScrollEnabled to true will cause custom animated gesture not working,
                 * but whatever, we CAN'T apply any type meaningful gesture to RNW
                 * @platform android
                 */
                nestedScrollEnabled: false,
                allowsInlineMediaPlayback: true,
                disableJsPromptLike: !isActiveTab,
              }}
            />
          );
        })}
      </>

      {browserState.isShowSearch ? (
        <BrowserSearch
          searchText={browserState.searchText}
          setSearchText={v => {
            setPartialBrowserState({
              searchText: v,
            });
          }}
          onClose={() => {
            if (!browserService.getBrowserTabs()?.tabs?.length) {
              setPartialBrowserState({
                isShowBrowser: false,
                isShowSearch: false,
                searchText: '',
                searchTabId: '',
              });
            } else {
              setPartialBrowserState({
                isShowSearch: false,
                searchText: '',
                searchTabId: '',
              });
            }
            console.log('onClose');
            // setVisibleState(prev => ({
            //   ...prev,
            //   isShowSearch: false,
            // }));
            // setSearchState(prev => ({
            //   ..
            // }))
          }}
          onOpenURL={url => {
            console.log(activeDappWebViewControlRef?.current?.getTabId());
            if (
              browserState.searchTabId &&
              activeDappWebViewControlRef?.current?.getTabId() ===
                browserState.searchTabId
            ) {
              activeDappWebViewControlRef?.current.navigateTo(url);
            } else {
              openTab(url);
            }
          }}
        />
      ) : null}
    </View>
  );
}

const getScreenStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      height: '100%',
      backgroundColor: colors2024['neutral-bg-1'],
      position: 'relative',
    },
    containerDefaultPadding: {
      paddingTop: 56,
      paddingBottom: IS_ANDROID ? 0 : 0,
    },
    __TEST_TEXT__: {
      color: colors2024['neutral-title-1'],
      fontSize: 16,
      fontFamily: 'SF Pro',
    },
  };
});
