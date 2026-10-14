import React, { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TITLE_STYLE,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { SIMPLE_INTERVAL_GROUPS } from '@/constant/perpsSimpleChart';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import { useTheme2024 } from '@/hooks/theme';
import * as apisAutoLock from '@/core/apis/autoLock';
import { createGetStyles2024 } from '@/utils/styles';
import { SIMPLE_CHART_COLORS } from './visual';

export const PerpsSimpleCandleIntervalSheet = React.memo(
  function PerpsSimpleCandleIntervalSheet({
    visible,
    selected,
    onClose,
    onConfirm,
    onPrefetch,
  }: {
    visible: boolean;
    selected: PerpsCandleDataInterval;
    onClose: () => void;
    onConfirm: (interval: PerpsCandleDataInterval) => void;
    onPrefetch?: (interval: PerpsCandleDataInterval) => void;
  }) {
    const modal = useRef<AppBottomSheetModal>(null);
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const { t } = useTranslation();
    useEffect(() => {
      if (visible) {
        modal.current?.present();
      } else modal.current?.close();
    }, [visible]);
    useEffect(() => {
      if (!visible) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onClose();
        return true;
      });
      return () => sub.remove();
    }, [visible, onClose]);
    const backdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.3}
          onPress={apisAutoLock.uiRefreshTimeout}
          style={[
            props.style,
            { backgroundColor: colors2024['neutral-black'] },
          ]}
        />
      ),
      [colors2024],
    );
    return (
      <AppBottomSheetModal
        ref={modal}
        onDismiss={onClose}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
        })}
        enableDynamicSizing
        backdropComponent={backdrop}
        backgroundStyle={styles.background}
        handleStyle={styles.handle}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.modal}>
        <BottomSheetView>
          <View style={styles.content}>
            <Text style={styles.title}>
              {t('page.perpsDetail.simpleChart.intervalTitle')}
            </Text>
            <Text style={styles.description}>
              {t('page.perpsDetail.simpleChart.intervalDescription')}
            </Text>
            <View style={styles.groups}>
              {SIMPLE_INTERVAL_GROUPS.map(group => (
                <View key={group.key} style={styles.group}>
                  <Text style={styles.groupTitle}>
                    {t(`page.perpsDetail.simpleChart.${group.key}`)}
                  </Text>
                  <View style={styles.options}>
                    {group.values.map(interval => (
                      <Pressable
                        key={interval}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selected === interval }}
                        style={[
                          styles.option,
                          selected === interval && styles.selected,
                        ]}
                        onPressIn={() => onPrefetch?.(interval)}
                        onPress={() => {
                          onConfirm(interval);
                          onClose();
                        }}>
                        <Text style={styles.optionText}>
                          {interval.endsWith('d') || interval.endsWith('w')
                            ? interval.toUpperCase()
                            : interval}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.footer}>
            <Button
              title={t('global.closeButton')}
              height={BOTTOM_BUTTON_SINGLE_HEIGHT}
              titleStyle={[BOTTOM_BUTTON_TITLE_STYLE, styles.buttonTitle]}
              buttonStyle={styles.button}
              onPress={onClose}
            />
          </View>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);
const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    modal: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      overflow: 'hidden',
    },
    background: {
      backgroundColor: colors2024['neutral-bg-0'],
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    handle: {
      height: 40,
      paddingTop: 10,
      paddingBottom: 24,
      backgroundColor: colors2024['neutral-bg-0'],
    },
    handleIndicator: {
      width: 50,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors2024['neutral-sheet-handle'],
    },
    content: { paddingHorizontal: 16, paddingTop: 8 },
    title: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '900',
      fontSize: 20,
      lineHeight: 24,
      textAlign: 'center',
      color: colors2024['neutral-title-1'],
    },
    description: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      textAlign: 'center',
      marginTop: 6,
      color: colors2024['neutral-secondary'],
    },
    groups: { marginTop: 16, gap: 16 },
    group: { gap: 8 },
    groupTitle: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 12,
      lineHeight: 16,
      color: colors2024['neutral-foot'],
    },
    options: { flexDirection: 'row', gap: 8 },
    option: {
      flex: 1,
      height: 40,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024[isLight ? 'neutral-bg-1' : 'neutral-bg-2'],
    },
    selected: {
      backgroundColor: SIMPLE_CHART_COLORS.selected,
      borderColor: SIMPLE_CHART_COLORS.selectedBorder,
    },
    optionText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '500',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-title-1'],
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
      paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom),
    },
    button: {
      backgroundColor: SIMPLE_CHART_COLORS.accent,
      borderRadius: 12,
      shadowColor: SIMPLE_CHART_COLORS.buttonShadow,
      shadowRadius: 12,
      shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 8 },
    },
    buttonTitle: { color: SIMPLE_CHART_COLORS.buttonText },
  }),
);
