import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles2024 } from '@/utils/styles';
import { makeThemeOptions, useAppTheme, useTheme2024 } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useTranslation } from 'react-i18next';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';

const themeSelectorModalVisibleAtom = atom(false);
export function useThemeSelectorModalVisible() {
  const [themeSelectorModalVisible, setThemeSelectorModalVisible] = useAtom(
    themeSelectorModalVisibleAtom,
  );

  return {
    themeSelectorModalVisible,
    setThemeSelectorModalVisible,
  };
}

export default function ThemeSelectorModal({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const { t } = useTranslation();

  const { ThemeModeOptions, FULL_HEIGHT } = useMemo(() => {
    const options = makeThemeOptions(t);
    return {
      ThemeModeOptions: options,
      FULL_HEIGHT:
        SIZES.HANDLE_HEIGHT +
        (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
        (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (options.length - 1) +
        SIZES.ITEM_HEIGHT +
        SIZES.containerPb,
    };
  }, [t]);

  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: FULL_HEIGHT,
    containerPaddingBottom: SIZES.containerPb,
  });
  const { toggleShowSheetModal } = useSheetModals({
    selectThemeMode: modalRef,
  });

  const { themeSelectorModalVisible: visible, setThemeSelectorModalVisible } =
    useThemeSelectorModalVisible();

  useEffect(() => {
    toggleShowSheetModal('selectThemeMode', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { appTheme, toggleThemeMode } = useAppTheme();

  const handleCancel = useCallback(() => {
    setThemeSelectorModalVisible(false);
    onCancel?.();
  }, [setThemeSelectorModalVisible, onCancel]);

  return (
    <AppBottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      onDismiss={handleCancel}
      enableContentPanningGesture={true}>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>
          {t('page.settingModal.themeMode.title')}
        </Text>
        <View style={styles.mainContainer}>
          {ThemeModeOptions.map((item, idx) => {
            const itemKey = `thememode-${item.title}-${item.value}`;
            const isSelected = appTheme === item.value;

            return (
              <TouchableView
                style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                key={itemKey}
                onPress={() => {
                  toggleThemeMode(item.value);
                  setThemeSelectorModalVisible(false);
                }}>
                <Text style={styles.settingItemLabel}>{item.title}</Text>
                {isSelected && (
                  <View>
                    <RcIconCheckmarkCC color={colors2024['green-default']} />
                  </View>
                )}
              </TouchableView>
            );
          })}
        </View>
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
      fontSize: 20,
      fontWeight: '500',
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
      paddingTop: 18,
      paddingBottom: 18,
      paddingHorizontal: 20,
      backgroundColor: ctx.isLight
        ? ctx.colors2024['neutral-bg-1']
        : ctx.colors2024['neutral-bg-2'],
      borderRadius: 8,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    settingItemLabel: {
      color: ctx.colors2024['neutral-title-1'],
      fontSize: 16,
      fontStyle: 'normal',
      fontWeight: '500',
    },
  };
});
