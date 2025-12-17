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
import { useRoute } from '@react-navigation/native';
import { HomeNavigatorParamsList } from '@/navigation-type';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import LinearGradient from 'react-native-linear-gradient';

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

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'HomeNavigatorParamsList',
        'DappWebViewStubOnHome'
      >
    >();
  const { dappsWebViewFromRoute = RootNames.Dapps } = route.params || {};

  const {
    openedDappItems,
    finalActiveDappId,
    activeDapp,
    collapseDappWebViewScreen,
    closeOpenedDapp,
    clearActiveDappOrigin,
  } = useDappWebViewScreen();

  const activeDappWebViewControlRef = useRef<DappWebViewControl2Type>(null);

  const { isDappConnected, disconnectDapp, updateFavorite } = useDapps();

  const navigation = useRabbyAppNavigation();

  /**
   * @description we put this screen at top level home-navigator (which's bottom-tabs-navigator)
   */
  const backToDappsScreen = useCallback(() => {
    switch (dappsWebViewFromRoute) {
      case RootNames.Dapps:
      case RootNames.FavoriteDapps: {
        navigation.navigateDeprecated(RootNames.StackDapps, {
          screen: dappsWebViewFromRoute,
        });
        break;
      }

      case 'back': {
        navigation.pop();
        break;
      }

      default: {
        navigation.replace(RootNames.StackDapps, {
          screen: dappsWebViewFromRoute,
        });
      }
    }
  }, [navigation, dappsWebViewFromRoute]);

  const hideDappWebViewScreen = useCallback(
    (ctx?: DappWebViewHideContext) => {
      backToDappsScreen();

      if (IS_ANDROID && ctx?.dappOrigin) {
        closeOpenedDapp(ctx?.dappOrigin);
        clearActiveDappOrigin();
      } else {
        const { willClose } = collapseDappWebViewScreen(ctx);
        if (!willClose) return;
        clearActiveDappOrigin();
      }
    },
    [
      closeOpenedDapp,
      collapseDappWebViewScreen,
      clearActiveDappOrigin,
      backToDappsScreen,
    ],
  );

  useLayoutEffect(() => {
    const listener = () => {
      // prevent default action
      const shouldPrevent =
        getLatestNavigationName() === RootNames.DappWebViewStubOnHome;
      if (shouldPrevent) {
        backToDappsScreen();
      }

      return shouldPrevent;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', listener);

    return () => {
      sub.remove();
    };
  }, [backToDappsScreen]);

  // const hasOpenedDapps = !!openedDappItems.length && !!activeDapp;

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
            !activeDapp ? styles.bgMustBeTransparent : styles.bsViewOpened,
            {
              // paddingTop: containerPaddingTop,
              // paddingBottom: containerPaddingBottom,
              // ...makeDevOnlyStyle({
              ///  // backgroundColor: 'blue',
              //   // height: '100%'
              // })
            },
          ]}>
          {!openedDappItems.length && !IS_ANDROID && (
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
          {openedDappItems.map((dappInfo, idx) => {
            const isConnected = !!dappInfo && isDappConnected(dappInfo.origin);
            const isFavorited = dappInfo.maybeDappInfo?.isFavorite ?? false;
            const isActiveDapp = activeDapp?.origin === dappInfo.origin;
            const key = `${dappInfo.origin}-${dappInfo.dappTabId}`;

            return (
              <DappWebViewControl2
                key={key}
                ref={inst => {
                  if (isActiveDapp) {
                    globalSetActiveDappState({ dappOrigin: dappInfo.origin });
                    // @ts-expect-error
                    activeDappWebViewControlRef.current = inst;
                    globalSetActiveDappState({
                      dappOrigin: dappInfo.origin,
                      tabId: dappInfo.dappTabId,
                    });
                  }
                }}
                style={[!isActiveDapp && { display: 'none' }]}
                dappOrigin={dappInfo.origin}
                dappTabId={dappInfo.dappTabId}
                initialUrl={dappInfo.$openParams?.initialUrl}
                onSelfClose={reason => {
                  if (reason === 'phishing') {
                    closeOpenedDapp(dappInfo.origin);
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
                  disableJsPromptLike: !isActiveDapp,
                }}
                headerRight={<WebViewHeaderRight activeDapp={activeDapp} />}
                onPressHeaderLeftClose={ctx => {
                  hideDappWebViewScreen(ctx);
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
          {openedDappItems.length > 0 && activeDapp && (
            <AccountSwitcherModalInDappWebView
              activeDappId={finalActiveDappId}
            />
          )}
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
