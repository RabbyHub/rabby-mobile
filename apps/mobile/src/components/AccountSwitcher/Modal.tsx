import { TouchableOpacity, View } from 'react-native';
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
import { AccountsPanelInModal } from './AccountsPanel';
import AutoLockView from '../AutoLockView';
import { useLayoutEffect } from 'react';
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
    modalBackgroundHeight: ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
  });

  useLayoutEffect(() => {
    return () => {
      toggleSceneVisible(forScene, false);
    };
  }, [forScene, toggleSceneVisible]);

  if (!isVisible) return null;

  const absoluteStyle = {
    top: topValue + ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
    maxHeight: Math.floor(offScreen.modalBackgroundHeight),
  };

  console.log('[feat] panelLinearGradientProps', panelLinearGradientProps);

  return (
    <AutoLockView
      style={[
        styles.container,
        inScreen && { zIndex: 19 },
        !isVisible && { display: 'none' },
        absoluteStyle,
      ]}>
      <TouchableOpacity
        onPressIn={() => {
          toggleSceneVisible(forScene, false);
        }}
        style={[styles.bgMask, { height: absoluteStyle.maxHeight }]}
        delayLongPress={1000}
      />
      <View
        style={[styles.panelContainer, { maxHeight: absoluteStyle.maxHeight }]}>
        <AccountsPanelInModal
          linearContainerProps={panelLinearGradientProps}
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
      // height: '50%',
      ...(IS_ANDROID
        ? {
            maxHeight: '90%',
          }
        : {
            height: '50%',
          }),
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'blue',
      // }),
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
  inScreen = false,
}: AccountSwitcherAopProps<{
  activeDappId?: DappInfo['origin'];
  inScreen?: boolean;
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

  if (!isVisible) return null;

  const absoluteStyle = IS_ANDROID
    ? {
        top:
          ScreenLayouts2.dappWebViewControlHeaderHeight -
          /* I don't know how it make sense but it's proper */
          8,
        maxHeight: Math.floor(offScreen.modalBackgroundHeight),
      }
    : {
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
        onPressIn={() => {
          toggleSceneVisible(forScene, false);
        }}
        style={[styles.bgMask, { height: absoluteStyle.maxHeight }]}
        delayLongPress={1000}
      />
      <View
        style={[styles.panelContainer, { maxHeight: absoluteStyle.maxHeight }]}>
        <AccountsPanelInModal
          forScene={forScene}
          onSwitchSceneAccount={ctx => {
            if (!activeDappId) return;
            setDappCurrentAccount(activeDappId, ctx.sceneAccount);
            ctx.switchAction();
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
      height: '50%',
      ...(IS_ANDROID
        ? {
            maxHeight: '90%',
          }
        : {
            height: '50%',
          }),
      // ...makeDevOnlyStyle({
      //   backgroundColor: 'blue',
      // }),
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
