import {
  forwardRef,
  useRef,
  useMemo,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Text, View, StyleSheet } from 'react-native';

import { AppBottomSheetModal } from '@/components';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { TIME_SETTINGS } from '@/constant/autoLock';
import { RcIconCheckmarkCC } from '@/assets/icons/common';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import TouchableView from '@/components/Touchable/TouchableView';
import { onAutoLockTimeMsChange, useAutoLockTime } from '@/hooks/appTimeout';
import AutoLockView from '@/components/AutoLockView';
import { useTranslation } from 'react-i18next';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import { FontWeightEnum } from '@/core/utils/fonts';
import { IS_ANDROID } from '@/core/native/utils';

const RcIconCheckmark = makeThemeIconFromCC(RcIconCheckmarkCC, 'green-default');

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
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) *
        Math.min(5, TIME_SETTINGS.length - 1) +
      SIZES.ITEM_HEIGHT +
      SIZES.containerPb +
      SIZES.listBottomSpace +
      (IS_ANDROID ? 30 : 0) /* compensation distance */
    );
  },
};
export const SelectAutolockTimeBottomSheetModal = forwardRef<
  BottomSheetModal,
  {
    onConfirm?: () => void;
    onCancel?: () => void;
  }
>((props, ref) => {
  const { onConfirm, onCancel } = props;
  const sheetModalRef = useRef<BottomSheetModal>(null);
  const { safeSizes } = useSafeAndroidBottomSizes({
    sheetHeight: SIZES.FULL_HEIGHT,
  });
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { timeoutMs } = useAutoLockTime();

  const handleConfirm = useCallback(
    (ms: number) => {
      onAutoLockTimeMsChange(ms);
      onConfirm?.();
      sheetModalRef.current?.dismiss();
    },
    [onConfirm],
  );

  useImperativeHandle(
    ref,
    () => sheetModalRef?.current || ({} as BottomSheetModalMethods),
  );
  return (
    <AppBottomSheetModal
      index={0}
      ref={sheetModalRef}
      {...makeBottomSheetProps({
        colors: colors2024,
        linearGradientType: isLight ? 'bg0' : 'bg1',
      })}
      snapPoints={[SIZES.FULL_HEIGHT]}
      onChange={index => {
        if (index <= 0) {
          onCancel?.();
        }
      }}
      enableContentPanningGesture
      enablePanDownToClose>
      <AutoLockView
        as="View"
        // scrollEnabled={false}
        style={[
          styles.container,
          {
            paddingBottom: 0,
          },
        ]}>
        <Text style={styles.title}>{t('page.setting.autoLockTime')}</Text>
        <BottomSheetScrollView style={styles.mainContainer}>
          {TIME_SETTINGS.map((item, idx) => {
            const labelText = item.getLabel();
            const itemKey = `timesetting-${labelText}-${item.milliseconds}`;
            const isSelected = timeoutMs === item.milliseconds;

            return (
              <TouchableView
                style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                key={itemKey}
                onPress={() => {
                  handleConfirm(item.milliseconds);
                }}>
                <Text style={styles.settingItemLabel}>{labelText}</Text>
                {isSelected && (
                  <View>
                    <RcIconCheckmark style={{ width: 24, height: 24 }} />
                  </View>
                )}
              </TouchableView>
            );
          })}
          {!!TIME_SETTINGS.length && <View style={styles.bottomSpacer} />}
        </BottomSheetScrollView>
      </AutoLockView>
    </AppBottomSheetModal>
  );
});

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    paddingVertical: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: '100%',
    paddingBottom: SIZES.containerPb,
    // height: SIZES.CONTENT_HEIGHT,
    // ...makeDebugBorder('yellow'),
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

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ctx.colors2024['neutral-bg-1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },
}));
