import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import AutoLockView from '@/components/AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BrowserScreen } from '../BrowserScreen';
import { useEffect, useRef } from 'react';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { Platform, Text, useWindowDimensions, View } from 'react-native';
import { BrowserManage } from '../BrowserScreen/components/BrowserManage';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { createGetStyles2024 } from '@/utils/styles';

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
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const modalRef = useRef<AppBottomSheetModal>(null);
  const { width } = useWindowDimensions();

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
      enableContentPanningGesture={Platform.OS === 'ios'}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={[safeOffScreenTop]}
      enableDismissOnClose={false}
      // keyboardBlurBehavior="restore"
      keyboardBehavior="extend"
      handleStyle={styles.hidden}
      containerStyle={styles.customContentStyle}
      backgroundComponent={null}
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
      <AutoLockView as="BottomSheetView" style={styles.customContentStyle}>
        <BottomSheetHandlableView
          style={[
            styles.customHandleContainer,
            {
              left: width / 2 - 25,
            },
          ]}>
          <View style={styles.customHandle} />
        </BottomSheetHandlableView>
        <BrowserScreen />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BrowserManagePopup = () => {
  const { safeOffScreenTop } = useSafeSizes();

  const { browserState, setPartialBrowserState } = useBrowser();
  const { colors2024, styles } = useTheme2024({ getStyle });

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
      enableContentPanningGesture={true}
      enablePanDownToClose
      enableHandlePanningGesture
      // name="urlWebviewContainerRef"
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      backgroundStyle={{
        backgroundColor: 'transparent',
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

const getStyle = createGetStyles2024(({ colors2024, isLight }) => {
  return {
    hidden: {
      display: 'none',
    },
    customContentStyle: {
      position: 'relative',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    customHandleContainer: {
      position: 'absolute',
      top: 0,
      zIndex: 30,
      paddingTop: 10,
      paddingBottom: 4,
    },
    customHandle: {
      width: 50,
      height: 6,
      borderRadius: 105,
      backgroundColor: colors2024['neutral-line'],
    },

    handleStyle: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handleIndicatorStyle: {
      backgroundColor: colors2024['neutral-line'],
      height: 6,
      width: 50,
    },
  };
});
