import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import AutoLockView from '@/components/AutoLockView';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { BOTTOM_SHEET_EXTRA } from '@/constant/browser';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserHistory } from '@/hooks/browser/useBrowserHistory';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { matomoRequestEvent } from '@/utils/analytics';
import {
  EVENT_SHOW_BROWSER,
  EVENT_SHOW_BROWSER_MANAGE,
  eventBus,
} from '@/utils/events';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, Platform, useWindowDimensions, View } from 'react-native';
import { BrowserScreen } from '../BrowserScreen';
import { BrowserManage } from '../BrowserScreen/components/BrowserManage';
import { BrowserHandler } from './BrowserHandler';
import { BrowserFavoriteManage } from '../BrowserScreen/components/BrowserFavoriteManage';

export const BottomSheetBrowser = () => {
  const { safeOffScreenTop } = useSafeSizes();
  const { browserState, setPartialBrowserState, onHideBrowser, terminateTabs } =
    useBrowser();
  const { styles } = useTheme2024({
    getStyle,
  });

  const [isLoad, setIsLoad] = useState(Platform.OS === 'ios');

  const modalRef = useRef<AppBottomSheetModal>(null);
  const { width } = useWindowDimensions();
  const { browserHistoryList } = useBrowserHistory();

  const snapPoints = useMemo(() => {
    return [safeOffScreenTop];
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
    if (browserState.isShowBrowser && !isLoad) {
      setTimeout(() => {
        setIsLoad(true);
      }, 250);
    }
  }, [browserState.isShowBrowser, isLoad]);

  useEffect(() => {
    if (browserState.isShowBrowser) {
      modalRef.current?.present();
    } else {
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

  return (
    <AppBottomSheetModal
      index={browserState.isShowBrowser ? 0 : -1}
      // enableContentPanningGesture={browserState.isShowSearch}
      enableContentPanningGesture={false}
      enablePanDownToClose
      enableHandlePanningGesture
      name="urlWebviewContainerRef"
      ref={modalRef}
      snapPoints={snapPoints}
      enableDismissOnClose={false}
      keyboardBehavior="extend"
      // android_keyboardInputMode="adjustResize"
      backdropProps={{ pressBehavior: 'none' }}
      // enableBlurKeyboardOnGesture
      // handleStyle={styles.hidden}
      handleComponent={BrowserHandler}
      containerStyle={styles.customContentStyle}
      backgroundComponent={null}
      onChange={index => {
        if (index === -1) {
          // 手动下拉关闭？
          if (browserState.isShowBrowser && !browserState.isShowSearch) {
            matomoRequestEvent({
              category: 'Websites Usage',
              action: `Website_Exit`,
              label: 'Drop Down',
            });
          }
          setPartialBrowserState({
            isShowBrowser: false,
            isShowSearch: false,
            searchText: '',
            searchTabId: '',
            trigger: '',
          });
          // onHideBrowser();
          terminateTabs();
        } else {
          matomoRequestEvent({
            category: 'Websites Usage',
            action: 'Website_Start',
          });
        }
      }}>
      <AutoLockView as="View" style={styles.customContentStyle}>
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
        {isLoad ? (
          <BrowserScreen style={isTransparent ? styles.transparent : null} />
        ) : (
          <View
            style={isTransparent ? styles.transparent : styles.placeholder}
          />
        )}
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BrowserManagePopup = () => {
  const { safeOffScreenTop } = useSafeSizes();

  const { browserState, setPartialBrowserState } = useBrowser();
  const { colors2024, styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [safeOffScreenTop - 40];
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
      enableHandlePanningGesture
      enableContentPanningGesture={true}
      enablePanDownToClose
      // name="urlWebviewContainerRef"
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      backgroundStyle={{
        backgroundColor: 'transparent',
      }}
      ref={modalRef}
      keyboardBehavior="extend"
      // android_keyboardInputMode="adjustResize"
      snapPoints={snapPoints}
      // enableDismissOnClose={false}
      onChange={index => {
        if (index === -1) {
          setPartialBrowserState({
            isShowManage: false,
          });
        }
      }}>
      <AutoLockView as="View">
        <BrowserManage />
      </AutoLockView>
    </AppBottomSheetModal>
  );
};

export const BrowserFavoritePopup = () => {
  const { safeOffScreenTop } = useSafeSizes();

  const { browserState, setPartialBrowserState, openTab } = useBrowser();
  const { colors2024, styles } = useTheme2024({ getStyle });

  const snapPoints = useMemo(() => {
    return [safeOffScreenTop - 40];
  }, [safeOffScreenTop]);

  const modalRef = useRef<AppBottomSheetModal>(null);

  useEffect(() => {
    if (browserState.isShowFavorite) {
      modalRef.current?.present();
    } else {
      modalRef.current?.close();
    }
  }, [browserState.isShowFavorite]);

  const handleBackPress = useCallback(() => {
    if (browserState.isShowFavorite) {
      setPartialBrowserState({
        isShowFavorite: false,
      });
      return true;
    }
    return false;
  }, [browserState.isShowFavorite, setPartialBrowserState]);

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
      index={browserState.isShowFavorite ? 0 : -1}
      enableHandlePanningGesture
      enableContentPanningGesture={true}
      enablePanDownToClose
      // name="urlWebviewContainerRef"
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      ref={modalRef}
      keyboardBehavior="extend"
      // android_keyboardInputMode="adjustResize"
      snapPoints={snapPoints}
      // enableDismissOnClose={false}
      onChange={index => {
        if (index === -1) {
          setPartialBrowserState({
            isShowFavorite: false,
          });
        }
      }}>
      <AutoLockView as="View">
        <BrowserFavoriteManage />
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
      backgroundColor: colors2024['neutral-bg-5'],
    },

    handleStyle: {
      backgroundColor: isLight
        ? colors2024['neutral-bg-0']
        : colors2024['neutral-bg-1'],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handleIndicatorStyle: {
      backgroundColor: colors2024['neutral-bg-5'],
      height: 6,
      width: 50,
    },

    handleComponent: {
      position: 'absolute',
      top: -40,
      right: 10,
      zIndex: 100,
    },
    handleComponentContainer: {
      display: 'flex',
      backgroundColor: colors2024['neutral-bg-1'],
      alignItems: 'center',
      flexDirection: 'row',
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 19,
      gap: 8,
    },
    placeholder: {
      backgroundColor: colors2024['neutral-bg-1'],
      height: '100%',
    },

    transparent: { backgroundColor: 'transparent' },
  };
});
