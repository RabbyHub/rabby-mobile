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
import { useForceLocalVersionForNonProduction } from '@/hooks/version';
import { APP_VERSIONS } from '@/constant';

const localVersionSelectorModalVisibleAtom = atom(false);
export function useLocalVersionSelectorModalVisible() {
  const { currentLocalVersion } = useForceLocalVersionForNonProduction();
  const [localVersionSelectorModal, setLocalVersionSelectorModalVisible] =
    useAtom(localVersionSelectorModalVisibleAtom);

  return {
    currentLocalVersion,
    localVersionSelectorModal,
    setLocalVersionSelectorModalVisible,
  };
}

const LocalVersionOptions = [
  {
    title: '0.1.0',
    value: '0.1.0',
  },
  {
    title: `${APP_VERSIONS.forCheckUpgrade} (Real)`,
    value: APP_VERSIONS.forCheckUpgrade,
  },
  {
    title: '99.99.99',
    value: '99.99.99',
  },
] as const;

export default function DevForceLocalVersionSelector({
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

  const {
    localVersionSelectorModal: visible,
    setLocalVersionSelectorModalVisible,
  } = useLocalVersionSelectorModalVisible();

  useEffect(() => {
    toggleShowSheetModal('selectThemeMode', visible || 'destroy');
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);

  const { currentLocalVersion, forceLocalVersion } =
    useForceLocalVersionForNonProduction();

  const handleCancel = useCallback(() => {
    setLocalVersionSelectorModalVisible(false);
    onCancel?.();
  }, [setLocalVersionSelectorModalVisible, onCancel]);

  return (
    <AppBottomSheetModal
      backgroundStyle={styles.sheet}
      ref={modalRef}
      index={0}
      snapPoints={[safeSizes.sheetHeight]}
      handleStyle={styles.handleStyle}
      onDismiss={handleCancel}
      enableContentPanningGesture>
      <AutoLockView
        as="View"
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Force local version</Text>
        <View style={styles.mainContainer}>
          {LocalVersionOptions.map((item, idx) => {
            const itemKey = `thememode-${item.title}-${item.value}`;
            const isSelected = currentLocalVersion === item.value;

            return (
              <TouchableView
                style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                key={itemKey}
                onPress={() => {
                  forceLocalVersion(item.value);
                  setLocalVersionSelectorModalVisible(false);
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
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (LocalVersionOptions.length - 1) +
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
