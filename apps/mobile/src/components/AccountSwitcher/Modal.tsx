import { Keyboard, TouchableOpacity, View } from 'react-native';
import { AccountSwitcherAopProps, useAccountSceneVisible } from './hooks';
import {
  createGetStyles2024,
  makeDebugBorder,
  makeDevOnlyStyle,
} from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeOffTop } from '@/hooks/useAppLayout';
import {
  ScreenLayouts2,
  ScreenWithAccountSwitcherLayouts,
} from '@/constant/layout';
import {
  AccountsPanelInModal,
  getAccountsPanelInModalMaxHeight,
} from './AccountsPanel';
import AutoLockView from '../AutoLockView';
import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { useDappCurrentAccount } from '@/hooks/useDapps';
import { DappInfo } from '@/core/services/dappService';
import { IS_ANDROID } from '@/core/native/utils';

export function AccountSwitcherModal({
  forScene,
  inScreen = false,
  panelLinearGradientProps,
}: AccountSwitcherAopProps<{
  inScreen?: boolean;
  panelLinearGradientProps?: React.ComponentProps<
    typeof AccountsPanelInModal
  >['linearContainerProps'];
}>) {
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(forScene);

  const { styles } = useTheme2024({ getStyle: getModalStyle });

  const { topValue, offScreen } = useSafeOffTop({
    modalBackgroundHeight:
      ScreenWithAccountSwitcherLayouts.screenHeaderHeight /*  + ScreenWithAccountSwitcherLayouts.modalBottomSpace */,
  });

  useLayoutEffect(() => {
    return () => {
      toggleSceneVisible(forScene, false);
    };
  }, [forScene, toggleSceneVisible]);

  const handlePressToClose = useCallback(() => {
    toggleSceneVisible(forScene, false);
  }, [forScene, toggleSceneVisible]);

  useEffect(() => {
    if (isVisible) {
      Keyboard.dismiss();
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const absoluteStyle = {
    top: topValue + ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
    maxHeight: Math.floor(offScreen.modalBackgroundHeight),
  };

  return (
    <AutoLockView
      style={[
        styles.container,
        inScreen && { zIndex: 19 },
        !isVisible && { display: 'none' },
        absoluteStyle,
      ]}>
      <TouchableOpacity
        onPressIn={handlePressToClose}
        style={[styles.bgMask, { height: absoluteStyle.maxHeight }]}
        delayLongPress={1000}
      />
      <View
        style={[styles.panelContainer, { maxHeight: absoluteStyle.maxHeight }]}>
        <AccountsPanelInModal
          linearContainerProps={panelLinearGradientProps}
          containerStyle={{
            maxHeight:
              getAccountsPanelInModalMaxHeight() -
              ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
          }}
          forScene={forScene}
        />
      </View>
    </AutoLockView>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    container: {
      position: 'absolute',
      width: '100%',
      // never write height here to avoid it cover to whole screen
      // height: '100%',
      top: 76,
      left: 0,
      right: 0,
      bottom: 0,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'red',
      // }),
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
      height:
        getAccountsPanelInModalMaxHeight() -
        ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
      ...makeDevOnlyStyle({
        backgroundColor: 'blue',
      }),
    },
    bgMask: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
    },
  };
});

export function AccountSwitcherModalInDappWebView({
  activeDappId,
  forScene,
  __IS_IN_SHEET_MODAL__ = false,
}: AccountSwitcherAopProps<{
  activeDappId?: DappInfo['origin'];
  __IS_IN_SHEET_MODAL__?: boolean;
}>) {
  const { isVisible, toggleSceneVisible } = useAccountSceneVisible(forScene);

  const { styles } = useTheme2024({ getStyle: getModalInDappWebViewStyle });

  const { topValue, offScreen } = useSafeOffTop({
    modalBackgroundHeight: ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
  });

  useLayoutEffect(() => {
    return () => {
      toggleSceneVisible(forScene, false);
    };
  }, [forScene, toggleSceneVisible]);

  const { setDappCurrentAccount } = useDappCurrentAccount();

  const handlePressToClose = useCallback(() => {
    toggleSceneVisible(forScene, false);
  }, [forScene, toggleSceneVisible]);

  const absoluteStyle = useMemo(() => {
    if (__IS_IN_SHEET_MODAL__) {
      return {
        top: IS_ANDROID
          ? ScreenLayouts2.dappWebViewControlHeaderHeight -
            /* I don't know how it make sense but it's proper */
            8
          : topValue + ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
        maxHeight: Math.floor(offScreen.modalBackgroundHeight),
      };
    }
    return {
      top: IS_ANDROID
        ? ScreenLayouts2.dappWebViewControlHeaderHeight -
          /* I don't know how it make sense but it's proper */
          8
        : ScreenLayouts2.dappWebViewControlHeaderHeight,
      maxHeight: Math.floor(offScreen.modalBackgroundHeight),
    };
  }, [__IS_IN_SHEET_MODAL__, topValue, offScreen.modalBackgroundHeight]);

  if (!isVisible) {
    return null;
  }

  return (
    <AutoLockView
      style={[
        styles.container,
        // inScreen && { zIndex: 19 },
        !isVisible && { display: 'none' },
        absoluteStyle,
      ]}>
      <TouchableOpacity
        onPressIn={handlePressToClose}
        style={[styles.bgMask, { height: absoluteStyle.maxHeight }]}
        delayLongPress={1000}
      />
      <View style={[styles.panelContainer]}>
        <AccountsPanelInModal
          forScene={forScene}
          onSwitchSceneAccount={async ctx => {
            if (!activeDappId) {
              return;
            }
            setDappCurrentAccount(activeDappId, ctx.sceneAccount);
            await ctx.switchAction();
          }}
        />
      </View>
    </AutoLockView>
  );
}

const getModalInDappWebViewStyle = createGetStyles2024(ctx => {
  return {
    container: {
      position: 'absolute',
      width: '100%',
      // never write height here to avoid it cover to whole screen
      // height: '100%',
      top: 76,
      left: 0,
      right: 0,
      bottom: 0,
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'red',
      // }),
    },
    panelContainer: {
      position: 'relative',
      width: '100%',
      height:
        getAccountsPanelInModalMaxHeight() -
        ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
      ...makeDevOnlyStyle({
        backgroundColor: 'blue',
      }),
    },
    bgMask: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
    },
  };
});
