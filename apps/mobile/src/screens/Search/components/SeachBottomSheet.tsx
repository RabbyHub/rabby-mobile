import { AppBottomSheetModal } from '@/components/customized/BottomSheet';

import AutoLockView from '@/components/AutoLockView';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';

import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { BackHandler, useWindowDimensions, View } from 'react-native';
import { SearchInner } from './SearchInner';
import { atom, useAtom } from 'jotai';

const showSearchBottomAtom = atom(false);

export const useShowSearchBottomSheet = () => {
  return useAtom(showSearchBottomAtom);
};

export const GlobalSearchBottomSheet = () => {
  const { safeOffScreenTop } = useSafeSizes();

  const { styles } = useTheme2024({
    getStyle,
  });

  const [searchText, setSearchText] = useState('');

  const [showSearchBottomSheet, setShowSearchBottomSheet] =
    useShowSearchBottomSheet();

  const modalRef = useRef<AppBottomSheetModal>(null);
  const { width } = useWindowDimensions();

  const snapPoints = useMemo(() => {
    return [safeOffScreenTop];
  }, [safeOffScreenTop]);

  const isTransparent = !searchText;

  useEffect(() => {
    if (showSearchBottomSheet) {
      modalRef.current?.present();
      console.log('modalRef.current?.present');
    } else {
      modalRef.current?.dismiss();
      console.log('modalRef.current?.dismiss');
      setSearchText('');
    }
  }, [showSearchBottomSheet]);

  const handleBackPress = useCallback(() => {
    if (showSearchBottomSheet) {
      setShowSearchBottomSheet(false);

      return true;
    }
    return false;
  }, [setShowSearchBottomSheet, showSearchBottomSheet]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => subscription.remove();
  }, [handleBackPress]);

  return (
    <AppBottomSheetModal
      // index={showSearchBottomSheet ? 0 : -1}
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
      handleStyle={styles.hidden}
      // handleComponent={() => <View>{null}</View>}
      containerStyle={styles.customContentStyle}
      backgroundComponent={null}
      onChange={index => {
        if (index === -1) {
          setShowSearchBottomSheet(false);
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
        <SearchInner searchText={searchText} setSearchText={setSearchText} />
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
