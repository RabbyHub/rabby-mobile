import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import { RcIconCheckmarkCC } from '@/assets/icons/common';

import { AppBottomSheetModal } from '@/components';
import { useSheetModals } from '@/hooks/useSheetModal';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import { useAppTheme, useThemeStyles } from '@/hooks/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { atom, useAtom } from 'jotai';

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
      ref={modalRef}
      index={0}
      snapPoints={[300]}
      onDismiss={handleCancel}
      enableContentPanningGesture={false}>
      <View style={styles.container}>
        {ThemeModeOptions.map(item => {
          const isCurrent = appTheme === item.value;
          const content = (
            <View style={[styles.item]}>
              <View style={styles.itemContent}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {/* <Text style={styles.itemDesc}>{item.desc}</Text> */}
              </View>
              {isCurrent && (
                <RcIconCheckmarkCC color={colors['green-default']} />
              )}
            </View>
          );
          return (
            <TouchableView
              key={item.value}
              onPress={() => {
                toggleThemeMode(item.value);
                setThemeSelectorModalVisible(false);
              }}>
              {content}
            </TouchableView>
          );
        })}
      </View>
    </AppBottomSheetModal>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    container: {
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'column',
      gap: 12,
      height: '100%',
      justifyContent: 'center',
      backgroundColor: colors['neutral-bg1'],
      // ...makeDebugBorder('blue')
    },
    item: {
      backgroundColor: colors['neutral-card2'],
      borderRadius: 6,
      paddingVertical: 20,
      paddingHorizontal: 16,

      flexDirection: 'row',
      alignItems: 'center',
    },
    itemDisabled: {
      opacity: 0.5,
    },
    itemContent: {
      marginRight: 'auto',
    },
    itemTitle: {
      color: colors['neutral-title1'],
      fontSize: 15,
      lineHeight: 18,
      fontWeight: '500',
      marginBottom: 4,
    },
    itemDesc: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
  };
});
