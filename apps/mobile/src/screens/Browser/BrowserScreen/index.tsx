import { globalSetActiveDappState } from '@/core/bridges/state';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';
import { preferenceService } from '@/core/services';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useSyncDappsInfo } from '@/hooks/useSyncDappsInfo';
import { isGoogle } from '@/utils/browser';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { BrowserSearch } from './components/BrowserSearch';
import { BrowserRef, BrowserTab } from './components/BrowserTab';

export function BrowserScreen({ style }: { style?: StyleProp<ViewStyle> }) {
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
    switchToTab,
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
      isScreenHide: !browserState.isShowBrowser && !browserState.isShowSearch,
    });
  }, [browserState.isShowBrowser, browserState.isShowSearch]);

  return (
    <View
      style={[
        stylesScreen.container,
        {
          paddingBottom: IS_ANDROID
            ? Math.max(androidOnlyBottomOffset, 16)
            : androidOnlyBottomOffset,
        },
        style,
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

          if (isActiveTab && tab.isTerminate && browserState.isShowSearch) {
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
                if (
                  !browserState.isShowSearch &&
                  browserState.isShowBrowser &&
                  isActiveTab
                ) {
                  setBrowserHistory({
                    url,
                    name,
                    createdAt: Date.now(),
                  });
                }
              }}
              onOpenTab={openTab}
              style={[
                !isActiveTab ? stylesScreen.hidden : null,
                browserState.isShowSearch ? stylesScreen.opacity0 : null,
              ]}
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
                setPartialBrowserState({
                  isShowBrowser: false,
                });
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
          trigger={browserState.trigger}
          onClose={shouldClose => {
            if (shouldClose) {
              setPartialBrowserState({
                isShowBrowser: false,
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
          }}
          onOpenURL={url => {
            if (!url?.trim()) {
              return;
            }
            if (
              browserState.searchTabId &&
              activeDappWebViewControlRef?.current?.getTabId() ===
                browserState.searchTabId
            ) {
              const targetOrigin = safeGetOrigin(url);
              const sameOriginTab = displayedTabs.find(
                item =>
                  safeGetOrigin(item.url || item.initialUrl) === targetOrigin,
              );
              if (sameOriginTab && !isGoogle(targetOrigin)) {
                switchToTab(sameOriginTab.id);
                return;
              }
              activeDappWebViewControlRef?.current.navigateTo(url);
              setPartialBrowserState({
                isShowSearch: false,
                searchText: '',
                searchTabId: '',
              });
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
    hidden: {
      display: 'none',
    },
    opacity0: {
      opacity: 0,
    },
  };
});
