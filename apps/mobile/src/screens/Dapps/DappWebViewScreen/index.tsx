import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { BackHandler, Dimensions, Text, View } from 'react-native';
import {
  DappWebViewHideContext,
  useDappWebViewScreen,
} from '../hooks/useDappWebViewScreen';
import AutoLockView from '@/components/AutoLockView';
import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';
import { useDapps } from '@/hooks/useDapps';
import DappWebViewControl2, {
  DappWebViewControl2Type,
} from '@/components/WebView/DappWebViewControl2/DappWebViewControl2';
import { globalSetActiveDappState } from '@/core/bridges/state';
import { WebViewHeaderRight } from '@/components/WebView/DappWebViewControl2/WebViewHeaderRight';
import { BottomNavControl2 } from '@/components/WebView/DappWebViewControl2/Widgets';
import { toast } from '@/components2024/Toast';
import { AccountSwitcherModalInDappWebView } from '@/components/AccountSwitcher/Modal';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { getLatestNavigationName } from '@/utils/navigation';
import { useNavigationState } from '@react-navigation/native';
import { HomeNavigatorParamsList } from '@/navigation-type';
import LinearGradient from 'react-native-linear-gradient';
import { BrowserTabList } from '@/components/WebView/BrowserTabList';

/**
 * @description this screen will be put on top level of App's navigation
 */
export function DappWebViewStubScreen() {
  const {
    styles: stylesScreen,
    colors,
    colors2024,
  } = useTheme2024({
    getStyle: getScreenStyle,
  });
  const { styles } = useTheme2024({ getStyle: getWebViewStubStyles });

  const { safeTop, androidOnlyBottomOffset } = useSafeSizes();

  const { dappsWebViewFromRoute = RootNames.Dapps } = useNavigationState(
    s =>
      s.routes.find(r => r.name === RootNames.DappWebViewStubOnHome)?.params ||
      {},
  ) as HomeNavigatorParamsList['DappWebViewStubOnHome'] & object;

  const {
    tabs,
    activeTab,
    // openedDappItems,
    // finalActiveDappId,
    // activeDapp,
    // collapseDappWebViewScreen,
    closeOpenedDapp,
    clearActiveDappOrigin,
  } = useDappWebViewScreen();

  const navigation = useRabbyAppNavigation();

  useLayoutEffect(() => {
    console.debug('DappWebViewStubScreen mounted');

    return () => {
      console.debug('DappWebViewStubScreen unmounted');
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
        <AutoLockView
          as="View"
          style={[
            styles.bsView,
            // !!openedDappItems.length && styles.bsViewOpened,
            !activeTab ? styles.bgMustBeTransparent : styles.bsViewOpened,
            {
              // paddingTop: containerPaddingTop,
              // paddingBottom: containerPaddingBottom,
              // ...makeDevOnlyStyle({
              ///  // backgroundColor: 'blue',
              //   // height: '100%'
              // })
            },
          ]}>
          {!tabs.length && !IS_ANDROID && (
            <SilentTouchableView
              style={{
                height: '100%',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Text
                style={{
                  color: __DEV__ ? colors['neutral-title1'] : 'transparent',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                No Dapp Opened, Touch here to close
              </Text>
            </SilentTouchableView>
          )}
          {tabs.map((tab, idx) => {
            // const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
            // const isFavorited = dappInfo.maybeDappInfo?.isFavorite ?? false;
            // const isActiveDapp = activeDapp?.origin === dappInfo.origin;
            // const key = `${dappInfo.origin}-${dappInfo.dappTabId}`;
            const isConnected = false;
            const isFavorited = false;
            const isActiveTab = activeTab?.id === tab.id;
            const key = tab.id;

            return (
              <DappWebViewControl2
                key={key}
                ref={inst => {
                  if (isActiveTab) {
                    // globalSetActiveDappState({ dappOrigin: dappInfo.origin });
                    // @ts-expect-error
                    // activeDappWebViewControlRef.current = inst;
                    // globalSetActiveDappState({
                    //   dappOrigin: dappInfo.origin,
                    //   tabId: dappInfo.dappTabId,
                    // });
                  }
                }}
                style={[!isActiveTab && { display: 'none' }]}
                dappOrigin={tab.url}
                dappTabId={tab.id}
                initialUrl={tab.url}
                onSelfClose={reason => {
                  if (reason === 'phishing') {
                    closeOpenedDapp(tab.url);
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
                // headerRight={<WebViewHeaderRight activeDapp={activeDapp} />}
                onPressHeaderLeftClose={ctx => {
                  navigation.goBack();
                  // hideDappWebViewScreen(ctx);
                }}
                navControlContent={({ webviewState, webviewActions }) => {
                  return (
                    <BottomNavControl2
                      webviewState={webviewState}
                      webviewActions={webviewActions}
                      isFavorited={isFavorited}
                      isConnected={isConnected}
                      onPressButton={ctx => {
                        switch (ctx.type) {
                          case 'disconnect': {
                            disconnectDapp(dappInfo.origin);
                            toast.success('Disconnected');
                            break;
                          }
                          case 'favorite': {
                            updateFavorite(dappInfo.origin, !isFavorited);
                            break;
                          }
                          default:
                            ctx.defaultAction(ctx);
                            break;
                        }
                      }}
                    />
                  );
                }}
              />
            );
          })}
          {/* {tabs.length > 0 && activeTab&& (
            <AccountSwitcherModalInDappWebView
              activeDappId={finalActiveDappId}
            />
          )} */}
        </AutoLockView>
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

function Header() {
  return (
    <View>
      <Text>You shouldnt View me!!!</Text>
    </View>
  );
}

DappWebViewStubScreen.Header = Header;
