import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useAppTheme, useThemeStyles } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { atom, useAtom } from 'jotai';
import AutoLockView from '@/components/AutoLockView';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';

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

const ThemeModeOptions = [
  {
    title: 'System',
    value: 'system',
  },
  {
    title: 'Light',
    value: 'light',
  },
  {
    title: 'Dark',
    value: 'dark',
  },
] as const;

export default function ThemeSelectorModal({
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

  const { themeSelectorModalVisible: visible, setThemeSelectorModalVisible } =
    useThemeSelectorModalVisible();

  useEffect(() => {
    toggleShowSheetModal('selectThemeMode', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const { appTheme, toggleThemeMode } = useAppTheme();

  const handleCancel = useCallback(() => {
    setThemeSelectorModalVisible(false);
    onCancel?.();
  }, [setThemeSelectorModalVisible, onCancel]);

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
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
        <Text style={styles.title}>Theme mode</Text>
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
                    <RcIconCheckmarkCC color={colors['green-default']} />
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
  get FULL_HEIGHT() {
    return (
      SIZES.HANDLE_HEIGHT +
      (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (ThemeModeOptions.length - 1) +
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
