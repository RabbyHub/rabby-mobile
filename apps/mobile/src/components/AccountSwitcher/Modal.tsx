import { Dimensions, Text, TouchableOpacity, View } from 'react-native';
import { AccountSwitcherAopProps, useAccountSwitcherScenes } from './hooks';
import { createGetStyles2024, makeDevOnlyStyle } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeOffTop } from '@/hooks/useAppLayout';
import { ScreenWithAccountSwitcherLayouts } from '@/constant/layout';
import { AccountsPanelInModal } from './AccountsPanel';
import AutoLockView from '../AutoLockView';
import { useLayoutEffect } from 'react';

export function AccountSwitcherModal({
  forScene,
  inScreen = false,
}: AccountSwitcherAopProps<{
  inScreen?: boolean;
}>) {
  const { isVisible, toggleSceneVisible } = useAccountSwitcherScenes(forScene);

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

  return (
    <View
      style={[
        styles.container,
        inScreen && { zIndex: 19 },
        !isVisible && { display: 'none' },
        absoluteStyle,
      ]}>
      <TouchableOpacity
        onPress={() => {
          setTimeout(() => {
            toggleSceneVisible(forScene, false);
          }, 50);
        }}
        style={[styles.bgMask, { height: absoluteStyle.maxHeight }]}
      />
      <AutoLockView
        style={[styles.panelContainer, { maxHeight: absoluteStyle.maxHeight }]}>
        <AccountsPanelInModal forScene={forScene} isVisible={isVisible} />
      </AutoLockView>
    </View>
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
      maxHeight: '80%',
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

/**
 * @deprecated
 */
export function GlobalAccountSwitcherStub() {
  return (
    <>
      <AccountSwitcherModal forScene="Send" />
      <AccountSwitcherModal forScene="Swap" />
      <AccountSwitcherModal forScene="Bridge" />
    </>
  );
}
