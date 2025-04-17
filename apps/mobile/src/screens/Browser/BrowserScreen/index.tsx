import { useLayoutEffect, useRef } from 'react';

import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { RootNames } from '@/constant/layout';
import { globalSetActiveDappState } from '@/core/bridges/state';
import { IS_ANDROID } from '@/core/native/utils';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { useLastUsedAccountInScreen } from '@/hooks/useLastUsedAccountInScreen';
import { HomeNavigatorParamsList } from '@/navigation-type';
import { createGetStyles2024 } from '@/utils/styles';
import { urlUtils } from '@rabby-wallet/base-utils';
import { useNavigationState } from '@react-navigation/native';
import { Dimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BrowserTab } from './components/BrowserTab';

export function BrowserScreen() {
  const {
    styles: stylesScreen,
    colors,
    colors2024,
  } = useTheme2024({
    getStyle: getScreenStyle,
  });
  const { styles } = useTheme2024({ getStyle: getWebViewStubStyles });

  useLastUsedAccountInScreen();

  const { safeTop, androidOnlyBottomOffset } = useSafeSizes();

  const activeDappWebViewControlRef = useRef<any>(null);

  const { dappsWebViewFromRoute = RootNames.Dapps } = useNavigationState(
    s =>
      s.routes.find(r => r.name === RootNames.DappWebViewStubOnHome)?.params ||
      {},
  ) as HomeNavigatorParamsList['DappWebViewStubOnHome'] & object;

  const { tabs, activeTabId, closeTab, updateTab, openTab } = useBrowser();

  const { setBrowserHistory } = useBrowserHistory();

  const navigation = useRabbyAppNavigation();

  useLayoutEffect(() => {
    console.debug('BrowserScreen mounted');

    return () => {
      console.debug('BrowserScreen unmounted');
    };
  }, []);

  return (
    <LinearGradient
      colors={[colors2024['neutral-bg-1'], colors2024['neutral-bg-3']]}
      start={{ x: 0, y: 0.0728 }}
      end={{ x: 0, y: 0.1614 }}>
      <View
        style={[
          stylesScreen.container,
          stylesScreen.containerDefaultPadding,
          {
            paddingTop: safeTop,
            paddingBottom: androidOnlyBottomOffset,
          },
        ]}>
        {!tabs.length ? (
          <BrowserTab origin={''} url="" onOpenTab={openTab} />
        ) : (
          <>
            {tabs.map((tab, idx) => {
              const isActiveTab = activeTabId === tab.id;
              const key = tab.id;
              const urlInfo = urlUtils.canoicalizeDappUrl(tab.url);

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
                  onUpdateTab={({ url, viewShot }) => {
                    updateTab(tab.id, {
                      url,
                      viewShot,
                    });
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
                  origin={tab.url}
                  tabId={tab.id}
                  url={tab.url}
                  tabsCount={tabs.length}
                  onSelfClose={reason => {
                    if (reason === 'phishing') {
                      // todo
                      closeTab(tab.id);
                    }
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
        )}
        {/* {tabs.length > 0 && activeTab&& (
            <AccountSwitcherModalInDappWebView
              activeDappId={finalActiveDappId}
            />
          )} */}
        <AccountSwitcherModal forScene="@ActiveDappWebViewModal" inScreen />
      </View>
    </LinearGradient>
  );
}

const getScreenStyle = createGetStyles2024(ctx => {
  return {
    container: {
      height: '100%',
      // backgroundColor: ctx.colors['neutral-bg-1'],
    },
    containerDefaultPadding: {
      paddingTop: 56,
      paddingBottom: IS_ANDROID ? 0 : 0,
    },
    __TEST_TEXT__: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 16,
      fontFamily: 'SF Pro',
    },
  };
});

const getWebViewStubStyles = createGetStyles2024(ctx => {
  const bgMustBeTransparent = {
    backgroundColor: 'transparent',
  };
  return {
    bgMustBeTransparent,
    sheetModalContainerStyle: { ...bgMustBeTransparent },
    modalBg: {
      paddingTop: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      /**
       * warning: never set backgroundColor other than transparent,
       * or you will see it cover on top of the screens in some cases.
       *
       * only set background color when you need debug the layout
       */
      ...bgMustBeTransparent,
    },
    sheetModal: {
      backgroundColor: ctx.colors['neutral-bg-1'],
    },
    bsView: {
      position: 'relative',
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
      // height: '100%',
      /** @why keep '100%' for iOS layout, but could set as windowHeight for Android */
      maxHeight: IS_ANDROID ? Dimensions.get('window').height : '100%',
      minHeight: 20,
      backgroundColor: ctx.colors['neutral-bg-1'],
      // ...makeDebugBorder('black'),
    },
    bsViewOpened: {
      height: '100%',
    },
  };
});
