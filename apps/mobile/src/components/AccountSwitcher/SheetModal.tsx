import { ScreenWithAccountSwitcherLayouts } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeOffTop } from '@/hooks/useAppLayout';
import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import {
  BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { useEffect, useRef, useState } from 'react';
import AutoLockView from '../AutoLockView';

import {
  AccountSwitcherAopProps,
  AccountSwitcherScene,
  useAccountSwitcherScenes,
} from './hooks';
import { RefreshAutoLockBottomSheetBackdrop } from '../patches/refreshAutoLockUI';
import useMount from 'react-use/lib/useMount';
import { AccountsPanelInModal } from './AccountsPanel';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

export function AccountsSwitcherSheetModal({
  forScene,
}: AccountSwitcherAopProps) {
  const { isVisible } = useAccountSwitcherScenes(forScene);
  const sheetModalRef = useRef<BottomSheetModal>(null);

  const { styles } = useTheme2024({ getStyle: getModalStyle });

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isVisible) {
        sheetModalRef.current?.present();
        sheetModalRef.current?.snapToIndex(1);
      } else {
        sheetModalRef.current?.collapse();
        sheetModalRef.current?.snapToIndex(-1);
      }
    }, 200);

    return () => {
      timer && clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, sheetModalRef.current]);

  // force mount once on mount;
  useMount(() => {
    sheetModalRef.current?.present();
    sheetModalRef.current?.snapToIndex(0);

    setTimeout(() => {
      sheetModalRef.current?.collapse();
      sheetModalRef.current?.snapToIndex(-1);
    }, 200);
  });

  const { offScreen } = useSafeOffTop({
    modalBackgroundHeight: ScreenWithAccountSwitcherLayouts.screenHeaderHeight,
  });
  const snapshots = [1, Math.floor(offScreen.modalBackgroundHeight)];

  return (
    <BottomSheetModal
      ref={sheetModalRef}
      handleComponent={null}
      // backdropComponent={renderBackdrop}
      enableDismissOnClose={false}
      // enableContentPanningGesture={false}
      enableDynamicSizing={false}
      snapPoints={snapshots}
      index={-1}
      // animateOnMount={false}
      animationConfigs={{
        duration: 0,
      }}
      backgroundStyle={styles.modalBg}>
      <AutoLockView as="BottomSheetView" style={styles.panel}>
        <AccountsPanelInModal />
      </AutoLockView>
    </BottomSheetModal>
  );
}

const getModalStyle = createGetStyles2024(ctx => {
  return {
    modalBg: {
      backgroundColor: 'rgba(0, 0, 0, 0.60)',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    panel: {
      backgroundColor: ctx.colors2024['neutral-bg-2'],
      minHeight: '50%',
      height: '50%',
      maxHeight: '70%',
      flexDirection: 'column',
    },
  };
});

/** @deprecated */
export function GlobalAccountSwitcherStub() {
  return (
    <>
      <AccountsSwitcherSheetModal forScene="Send" />
    </>
  );
}
