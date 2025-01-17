import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { atom, useAtom } from 'jotai';

import { RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useAppLanguage } from '@/hooks/lang';
import { SupportedLangs } from '@/utils/i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';

const currentLanguageModalVisibleAtom = atom(false);
export function useCurrentLanguageModalVisible() {
  const { currentLanguage } = useAppLanguage();
  const [currentLanguageModalVisible, setCurrentLanguageModalVisible] = useAtom(
    currentLanguageModalVisibleAtom,
  );

  return {
    currentLangLabel: useMemo(() => {
      return SupportedLangs.find(item => item.lang === currentLanguage)?.label;
    }, [currentLanguage]),
    currentLanguageModalVisible,
    setCurrentLanguageModalVisible,
  };
}

export default function CurrentLanguageSelectorModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: SIZES.FULL_HEIGHT,
    containerPaddingBottom: SIZES.containerPb,
  });
  const { toggleShowSheetModal } = useSheetModals({
    selectThemeMode: modalRef,
  });

  const { currentLanguage, setCurrentLanguage } = useAppLanguage();

  const {
    currentLanguageModalVisible: visible,
    setCurrentLanguageModalVisible,
  } = useCurrentLanguageModalVisible();

  useEffect(() => {
    toggleShowSheetModal('selectThemeMode', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const handleCancel = useCallback(() => {
    setCurrentLanguageModalVisible(false);
    onCancel?.();
  }, [setCurrentLanguageModalVisible, onCancel]);

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[640]}
      handleStyle={styles.handleStyle}
      onDismiss={handleCancel}
      enableContentPanningGesture={false}>
      <AutoLockView
        as="BottomSheetView"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <BottomSheetHandlableView>
          <Text style={styles.title}>Current Language</Text>
        </BottomSheetHandlableView>
        <BottomSheetScrollView style={styles.mainContainer}>
          {SupportedLangs.map((item, idx) => {
            const itemKey = `thememode-${item.lang}`;
            const isSelected = currentLanguage === item.lang;

            return (
              <TouchableView
                style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                key={itemKey}
                onPress={() => {
                  setCurrentLanguage(item.lang);
                  setCurrentLanguageModalVisible(false);
                }}>
                <Text style={styles.settingItemLabel}>{item.label}</Text>
                {isSelected && (
                  <View>
                    <RcIconCheckmarkCC color={colors['green-default']} />
                  </View>
                )}
              </TouchableView>
            );
          })}
        </BottomSheetScrollView>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 60,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 16,
  HANDLE_HEIGHT: 8,
  containerPb: 42,
  get FULL_HEIGHT() {
    return (
      SIZES.HANDLE_HEIGHT +
      (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (SupportedLangs.length - 1) +
      SIZES.ITEM_HEIGHT +
      SIZES.containerPb
    );
  },
};
const getStyles = createGetStyles((colors, ctx) => {
  return {
    sheet: {
      backgroundColor: colors['neutral-bg-2'],
    },
    handleStyle: {
      height: 8,
      backgroundColor: colors['neutral-bg-2'],
    },
    container: {
      flex: 1,
      paddingVertical: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      height: '100%',
      paddingBottom: SIZES.containerPb,
      // ...makeDebugBorder('blue')
    },
    title: {
      fontSize: 20,
      fontWeight: '500',
      color: colors['neutral-title-1'],
      textAlign: 'center',

      marginTop: SIZES.titleMt,
      minHeight: SIZES.titleHeight,
      marginBottom: SIZES.titleMb,
      // ...makeDebugBorder('red'),
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 20,
    },

    settingItem: {
      width: '100%',
      height: SIZES.ITEM_HEIGHT,
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 20,
      backgroundColor: !ctx?.isLight
        ? colors['neutral-card1']
        : colors['neutral-bg1'],
      borderRadius: 8,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    settingItemLabel: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
