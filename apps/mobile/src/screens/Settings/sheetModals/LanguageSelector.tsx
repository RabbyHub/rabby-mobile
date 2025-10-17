import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { atom, useAtom } from 'jotai';

import { RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useAppLanguage } from '@/hooks/lang';
import { SupportedLangs } from '@/utils/i18n';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetHandlableView } from '@/components/customized/BottomSheetHandle';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { FontWeightEnum } from '@/core/utils/fonts';

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

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const handleCancel = useCallback(() => {
    setCurrentLanguageModalVisible(false);
    onCancel?.();
  }, [setCurrentLanguageModalVisible, onCancel]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[640]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={handleCancel}
      enableContentPanningGesture
      enablePanDownToClose>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: 0,
          },
        ]}>
        <View>
          <Text style={styles.title}>Current Language</Text>
        </View>
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
                    <RcIconCheckmarkCC color={colors2024['green-default']} />
                  </View>
                )}
              </TouchableView>
            );
          })}
          {!!SupportedLangs.length && <View style={styles.bottomSpacer} />}
        </BottomSheetScrollView>
      </AutoLockView>
    </AppBottomSheetModal>
  );
}

const SIZES = {
  ITEM_HEIGHT: 72,
  ITEM_GAP: 12,
  titleMt: 6,
  titleHeight: 24,
  titleMb: 16,
  HANDLE_HEIGHT: 8,
  containerPb: 0,
  listBottomSpace: 48,
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
const getStyles = createGetStyles2024(ctx => {
  return {
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
      fontFamily: 'SF Pro Rounded',
      fontSize: 20,
      fontWeight: FontWeightEnum.heavy,
      lineHeight: 24,
      color: ctx.colors2024['neutral-title-1'],
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
      paddingTop: 0,
      paddingBottom: 0,
      paddingHorizontal: 24,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-1']
        : ctx.colors2024['neutral-bg-2'],
      borderRadius: 16,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    bottomSpacer: {
      height: SIZES.listBottomSpace,
    },
    settingItemLabel: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 16,
      lineHeight: 20,
      fontFamily: 'SF Pro Rounded',
      fontStyle: 'normal',
      fontWeight: FontWeightEnum.bold,
    },
  };
});
