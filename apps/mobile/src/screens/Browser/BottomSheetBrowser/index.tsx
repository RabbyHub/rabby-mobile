import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import AutoLockView from '@/components/AutoLockView';
import { RefreshAutoLockBottomSheetBackdrop } from '@/components/patches/refreshAutoLockUI';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BrowserScreen } from '../BrowserScreen';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBrowser } from '@/hooks/browser/useBrowser';
import {
  BackHandler,
  Dimensions,
  Platform,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { BrowserManage } from '../BrowserScreen/components/BrowserManage';
import { useTheme2024 } from '@/hooks/theme';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { createGetStyles2024 } from '@/utils/styles';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useFocusEffect } from '@react-navigation/native';
import { useMemoizedFn } from 'ahooks';
import {
  EVENT_SHOW_BROWSER,
  EVENT_SHOW_BROWSER_MANAGE,
  eventBus,
} from '@/utils/events';
import { BOTTOM_SHEET_EXTRA } from '@/constant/browser';
import { RcIconCloseBrowser } from '@/assets/icons/dapp';

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <RefreshAutoLockBottomSheetBackdrop
    {...props}
    disappearsOnIndex={-1}
    appearsOnIndex={0}
  />
);

export const BottomSheetBrowser = () => {
  const { safeOffScreenTop } = useSafeSizes();
  const {
    browserState,
    setPartialBrowserState,
    closeTab,
    onHideBrowser,
    activeTabId,
  } = useBrowser();
  const { browserHistoryList } = useBrowserHistory();
  const { colors2024, styles } = useTheme2024({
    getStyle,
  });

  const modalRef = useRef<AppBottomSheetModal>(null);
  const { width, height } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    return [
      Math.min(
        safeOffScreenTop - BOTTOM_SHEET_EXTRA,
        Dimensions.get('screen').height - 68,
      ),
    ];
  }, [safeOffScreenTop]);

  const isTransparent = useMemo(() => {
    return (
      browserState.trigger === 'home' &&
      !browserHistoryList?.length &&
      !browserState.searchText.trim() &&
      browserState.isShowSearch
    );
  }, [
    browserHistoryList?.length,
    browserState.isShowSearch,
    browserState.searchText,
    browserState.trigger,
  ]);

  useEffect(() => {
    if (browserState.isShowBrowser) {
      modalRef.current?.present();
    } else {
      console.log('[close]');
      modalRef.current?.close();
    }
  }, [browserState.isShowBrowser]);

  const handleBackPress = useCallback(() => {
    if (browserState.isShowBrowser) {
      setPartialBrowserState({
        isShowBrowser: false,
        isShowSearch: false,
        searchText: '',
      });
      return true;
    }
    return false;
  }, [browserState.isShowBrowser, setPartialBrowserState]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => subscription.remove();
  }, [handleBackPress]);

  useEffect(() => {
    const handler = () => {
      modalRef?.current?.present();
    };
    eventBus.addListener(EVENT_SHOW_BROWSER, handler);

    return () => {
      eventBus.removeListener(EVENT_SHOW_BROWSER, handler);
    };
  }, []);

  const handleCloseBrowser = useMemoizedFn(() => {
    closeTab(activeTabId);
    setPartialBrowserState({
      isShowBrowser: false,
      isShowSearch: false,
      searchText: '',
      searchTabId: '',
      trigger: '',
    });
    onHideBrowser();
  });

  return (
    <AppBottomSheetModal
      index={browserState.isShowBrowser ? 0 : -1}
      enableContentPanningGesture={browserState.isShowSearch}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={snapPoints}
      enableDismissOnClose={false}
      keyboardBehavior="extend"
      android_keyboardInputMode="adjustResize"
      // handleStyle={styles.hidden}
      handleComponent={() => {
        return browserState.isShowBrowser &&
          !browserState.isShowSearch &&
          !browserState.isShowManage ? (
          <View style={styles.handleComponent}>
            <TouchableOpacity onPress={handleCloseBrowser} hitSlop={5}>
              <RcIconCloseBrowser />
            </TouchableOpacity>
          </View>
        ) : null;
      }}
      containerStyle={styles.customContentStyle}
      backgroundComponent={null}
      onChange={index => {
        if (index === -1) {
          // // 手动下拉关闭？
          // if (browserState.isShowBrowser && !browserState.isShowSearch) {
          //   closeTab(activeTabId);
          // }
          setPartialBrowserState({
            isShowBrowser: false,
            isShowSearch: false,
            searchText: '',
            searchTabId: '',
            trigger: '',
          });
          onHideBrowser();
        }
      }}>
      <AutoLockView as="BottomSheetView" style={styles.customContentStyle}>
        {!isTransparent ? (
          <BottomSheetHandlableView
            style={[
              styles.customHandleContainer,
              {
                left: width / 2 - 25,
              },
            ]}>
            <View style={styles.customHandle} />
          </BottomSheetHandlableView>
        ) : null}
        <BrowserScreen
          style={isTransparent ? { backgroundColor: 'transparent' } : null}
        />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BrowserManagePopup = () => {
  const { safeOffScreenTop } = useSafeSizes();

  const { browserState, setPartialBrowserState } = useBrowser();
  const { colors2024, styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [
      Math.min(
        safeOffScreenTop - BOTTOM_SHEET_EXTRA,
        Dimensions.get('screen').height - 68,
      ),
    ];
  }, [safeOffScreenTop]);

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (browserState.isShowManage) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [browserState.isShowManage]);

  const handleBackPress = useCallback(() => {
    if (browserState.isShowManage) {
      setPartialBrowserState({
        isShowManage: false,
      });
      return true;
    }
    return false;
  }, [browserState.isShowManage, setPartialBrowserState]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => subscription.remove();
  }, [handleBackPress]);

  useEffect(() => {
    const handler = () => {
      modalRef?.current?.present();
    };
    eventBus.addListener(EVENT_SHOW_BROWSER_MANAGE, handler);

    return () => {
      eventBus.removeListener(EVENT_SHOW_BROWSER_MANAGE, handler);
    };
  }, []);

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
      keyboardBehavior="extend"
      android_keyboardInputMode="adjustResize"
      snapPoints={snapPoints}
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

    handleComponent: {
      position: 'absolute',
      top: -36,
      right: 8,
      zIndex: 100,
    },
  };
});
