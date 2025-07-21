import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import AutoLockView from '@/components/AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BrowserScreen } from '../BrowserScreen';
import { useEffect, useRef } from 'react';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { Text, View } from 'react-native';
import { BrowserManage } from '../BrowserScreen/components/BrowserManage';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

export const BottomSheetBrowser = () => {
  const { safeOffScreenTop } = useSafeSizes();
  const { visible, setVisible } = useBrowser();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      index={visible ? 0 : -1}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={[safeOffScreenTop]}
      enableDismissOnClose={false}
      keyboardBlurBehavior="restore"
      keyboardBehavior="extend"
      onChange={index => {
        if (index === -1) {
          setVisible(false);
        }
      }}>
      <AutoLockView as="BottomSheetView">
        <BrowserScreen />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BrowserManagePopup = () => {
  const { safeOffScreenTop } = useSafeSizes();
  const { isShowManagePopup: visible, setIsShowManagePopup: setVisible } =
    useBrowser();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [visible]);

  return (
    <AppBottomSheetModal
      index={visible ? 0 : -1}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      // name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={[safeOffScreenTop]}
      // enableDismissOnClose={false}
      onChange={index => {
        if (index === -1) {
          setVisible(false);
        }
      }}>
      <AutoLockView as="BottomSheetView">
        <BrowserManage />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};
