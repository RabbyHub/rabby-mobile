import { useRef } from 'react';

import { Dimensions, Text, View } from 'react-native';
import { AccountSwitcherAopProps, useAccountSwitcherScenes } from './hooks';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeOffTop } from '@/hooks/useAppLayout';
import { ScreenWithAccountSwitcherLayouts } from '@/constant/layout';
import { AccountsPanelInModal } from './AccountsPanel';
import AutoLockView from '../AutoLockView';

export function AccountSwitcherModal({ forScene }: AccountSwitcherAopProps) {
  const { isVisible } = useAccountSwitcherScenes(forScene);

  const { styles } = useTheme2024({ getStyle: getModalStyle });

  const { topValue, offScreen } = useSafeOffTop({
    modalBackgroundHeight: ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
  });

  return (
    <View
      style={[
        styles.container,
        !isVisible && { display: 'none' },
        {
          top: topValue + ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
          maxHeight: Math.floor(offScreen.modalBackgroundHeight),
        },
      ]}>
      <View style={styles.bgMask} />
      <AutoLockView style={styles.panel}>
        <AccountsPanelInModal />
      </AutoLockView>
    </View>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    container: {
      zIndex: 999,
      position: 'absolute',
      width: '100%',
      // height: '100%',
      // backgroundColor: 'blue',
      left: 0,
      right: 0,
      bottom: 0,
    },
    panel: {
      position: 'relative',
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      width: '100%',
      minHeight: '50%',
      height: '50%',
      maxHeight: '70%',
      flexDirection: 'column',
    },
    bgMask: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      minHeight: Dimensions.get('screen').height,
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
    },
  };
});
