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
import { useTheme2024 } from '@/hooks/theme';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

export const BottomSheetBrowser = () => {
  const { safeOffScreenTop } = useSafeSizes();
  const { browserState, setPartialBrowserState, closeTab, activeTabId } =
    useBrowser();
  const { colors2024 } = useTheme2024();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (browserState.isShowBrowser) {
      modalRef.current?.present();
    } else {
      console.log('[close]');
      modalRef.current?.close();
    }
  }, [browserState.isShowBrowser]);

  return (
    <AppBottomSheetModal
      index={browserState.isShowBrowser ? 0 : -1}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={[safeOffScreenTop]}
      enableDismissOnClose={false}
      // keyboardBlurBehavior="restore"
      keyboardBehavior="extend"
      handleStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
        // backgroundColor: 'transparent',
        // // height: 0,
      }}
      // backgroundComponent={({ style }) => {
      //   return (
      //     <View
      //       style={[
      //         style,
      //         {
      //           backgroundColor: colors2024['neutral-bg-0'],
      //           borderTopLeftRadius: 20,
      //           borderTopRightRadius: 20,
      //         },
      //       ]}
      //     />
      //   );
      // }}
      onChange={index => {
        console.log('[onChange]', index);
        if (index === -1) {
          // 手动下拉关闭？
          if (browserState.isShowBrowser && !browserState.isShowSearch) {
            closeTab(activeTabId);
          }
          setPartialBrowserState({
            isShowBrowser: false,
            isShowSearch: false,
            searchText: '',
            searchTabId: '',
          });
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

  const { browserState, setPartialBrowserState } = useBrowser();
  const { colors2024 } = useTheme2024();

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (browserState.isShowManage) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [browserState.isShowManage]);

  return (
    <AppBottomSheetModal
      index={browserState.isShowManage ? 0 : -1}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      // name="urlWebviewContainerRef"
      handleStyle={{
        backgroundColor: colors2024['neutral-bg-0'],
      }}
      ref={modalRef}
      snapPoints={[safeOffScreenTop]}
      // enableDismissOnClose={false}
      onChange={index => {
        if (index === -1) {
          setPartialBrowserState({
            isShowManage: false,
          });
        }
      }}>
      <AutoLockView as="BottomSheetView">
        <BrowserManage />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};
