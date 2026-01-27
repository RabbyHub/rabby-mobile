import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { atom, useAtom } from 'jotai';

import { RcIconCheckmarkCC } from '@/assets/icons/common';
import { AppBottomSheetModal } from '@/components';
import TouchableView from '@/components/Touchable/TouchableView';
import { useSheetModals } from '@/hooks/useSheetModal';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';

import {
  type InnerDappPreloadStrategy,
  setInnerDappPreloadStrategy,
  useInnerDappPreloadStrategy,
} from '@/config/innerDappPreloadStrategy';
import {
  MAX_RETAINED_WEBVIEWS_OPTIONS,
  setInnerDappPreloadRetention,
  useInnerDappPreloadRetention,
} from '@/config/innerDappPreloadRetention';

const selectorVisibleAtom = atom(false);

export function useInnerDappPreloadStrategySelectorModalVisible() {
  const [visible, setVisible] = useAtom(selectorVisibleAtom);
  const currentStrategy = useInnerDappPreloadStrategy();

  return {
    currentStrategy,
    visible,
    setVisible,
  };
}

const STRATEGY_OPTIONS: {
  title: string;
  value: InnerDappPreloadStrategy;
}[] = [
  {
    title: 'Legacy (Global overlay)',
    value: 'legacy',
  },
  {
    title: 'Screen overlay',
    value: 'screen',
  },
];

export default function InnerDappPreloadStrategySelector({
  onCancel,
}: RNViewProps & {
  onCancel?(): void;
}) {
  const modalRef = useRef<AppBottomSheetModal>(null);
  const sheetHeight = useMemo(
    () => Math.min(SIZES.FULL_HEIGHT, SIZES.MAX_SHEET_HEIGHT),
    [],
  );
  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight,
    containerPaddingBottom: SIZES.containerPb,
  });
  const { toggleShowSheetModal } = useSheetModals({
    innerDappPreloadStrategySelector: modalRef,
  });

  const { visible, setVisible } =
    useInnerDappPreloadStrategySelectorModalVisible();

  useEffect(() => {
    toggleShowSheetModal(
      'innerDappPreloadStrategySelector',
      visible || 'destroy',
    );
  }, [visible, toggleShowSheetModal]);

  const { styles, colors } = useThemeStyles(getStyles);
  const currentStrategy = useInnerDappPreloadStrategy();
  const currentRetention = useInnerDappPreloadRetention();
  const retentionDisabled = currentStrategy === 'screen';
  const resolvedRetention = retentionDisabled ? 1 : currentRetention;

  const handleCancel = useCallback(() => {
    setVisible(false);
    onCancel?.();
  }, [setVisible, onCancel]);

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
        <Text style={styles.title}>Inner Dapp Preload</Text>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>Strategy</Text>
          <View style={styles.mainContainer}>
            {STRATEGY_OPTIONS.map((item, idx) => {
              const itemKey = `inner-dapp-preload-${item.value}`;
              const isSelected = currentStrategy === item.value;

              return (
                <TouchableView
                  style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                  key={itemKey}
                  onPress={() => {
                    setInnerDappPreloadStrategy(item.value);
                    if (item.value === 'screen') {
                      setInnerDappPreloadRetention(1);
                    }
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
          <View style={styles.sectionSpacer} />
          <Text style={styles.sectionTitle}>Retained WebViews</Text>
          {retentionDisabled ? (
            <Text style={styles.sectionHint}>
              Forced to 1 for Screen strategy.
            </Text>
          ) : null}
          <View
            style={[
              styles.mainContainer,
              retentionDisabled && styles.sectionDisabled,
            ]}
            pointerEvents={retentionDisabled ? 'none' : 'auto'}>
            {MAX_RETAINED_WEBVIEWS_OPTIONS.map((value, idx) => {
              const itemKey = `inner-dapp-retained-${value}`;
              const isSelected = resolvedRetention === value;

              return (
                <TouchableView
                  style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                  key={itemKey}
                  onPress={() => {
                    setInnerDappPreloadRetention(value);
                  }}>
                  <Text style={styles.settingItemLabel}>{value}</Text>
                  {isSelected && (
                    <View>
                      <RcIconCheckmarkCC color={colors['green-default']} />
                    </View>
                  )}
                </TouchableView>
              );
            })}
          </View>
        </ScrollView>
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
  sectionTitleHeight: 20,
  sectionTitleGap: 8,
  sectionSpacer: 12,
  HANDLE_HEIGHT: 8,
  containerPb: 42,
  MAX_SHEET_HEIGHT: Math.round(Dimensions.get('window').height * 0.8),
  get FULL_HEIGHT() {
    return (
      SIZES.HANDLE_HEIGHT +
      (SIZES.titleMt + SIZES.titleHeight + SIZES.titleMb) +
      (SIZES.sectionTitleHeight + SIZES.sectionTitleGap) +
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (STRATEGY_OPTIONS.length - 1) +
      SIZES.ITEM_HEIGHT +
      SIZES.sectionSpacer +
      (SIZES.sectionTitleHeight + SIZES.sectionTitleGap) +
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) *
        (MAX_RETAINED_WEBVIEWS_OPTIONS.length - 1) +
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
    },
    title: {
      fontWeight: '700',
      fontSize: 16,
      color: colors['neutral-title-1'],
      marginTop: SIZES.titleMt,
      marginBottom: SIZES.titleMb,
    },
    scrollContainer: {
      width: '100%',
    },
    scrollContent: {
      paddingBottom: SIZES.containerPb,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '500',
      color: colors['neutral-body'],
      marginBottom: SIZES.sectionTitleGap,
      paddingHorizontal: 16,
    },
    sectionHint: {
      fontSize: 12,
      color: colors['neutral-body'],
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sectionSpacer: {
      height: SIZES.sectionSpacer,
    },
    mainContainer: {
      width: '100%',
      paddingHorizontal: 16,
    },
    settingItem: {
      height: SIZES.ITEM_HEIGHT,
      borderRadius: 16,
      paddingHorizontal: 16,
      backgroundColor: colors['neutral-bg-1'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    notFirstOne: {
      marginTop: SIZES.ITEM_GAP,
    },
    settingItemLabel: {
      fontSize: 15,
      color: colors['neutral-title-1'],
      fontWeight: '500',
    },
    sectionDisabled: {
      opacity: 0.5,
    },
  };
});
