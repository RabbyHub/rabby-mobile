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
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { TIME_SETTINGS } from '@/constant/autoLock';
import { RcIconCheckmarkCC } from '@/assets/icons/common';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import TouchableView from '@/components/Touchable/TouchableView';
import { useAutoLockTimeMs } from '@/hooks/appSettings';
import AutoLockView from '@/components/AutoLockView';
import { useTranslation } from 'react-i18next';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';

const RcIconCheckmark = makeThemeIconFromCC(RcIconCheckmarkCC, 'green-default');

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
      (SIZES.ITEM_HEIGHT + SIZES.ITEM_GAP) * (TIME_SETTINGS.length - 1) +
      SIZES.ITEM_HEIGHT +
      SIZES.containerPb
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
    containerPaddingBottom: SIZES.containerPb,
  });
  const { t } = useTranslation();

  const { styles, colors2024, isLight } = useTheme2024({ getStyle: getStyles });

  const { autoLockMs, onAutoLockTimeMsChange } = useAutoLockTimeMs();

  const handleConfirm = useCallback(
    (ms: number) => {
      onAutoLockTimeMsChange(ms);
      onConfirm?.();
      sheetModalRef.current?.dismiss();
    },
    [onAutoLockTimeMsChange, onConfirm],
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
      snapPoints={[safeSizes.sheetHeight]}
      onChange={index => {
        if (index <= 0) {
          onCancel?.();
        }
      }}>
      <AutoLockView
        as="BottomSheetView"
        // scrollEnabled={false}
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>{t('page.setting.autoLockTime')}</Text>
        <View style={styles.mainContainer}>
          {TIME_SETTINGS.map((item, idx) => {
            const labelText = item.getLabel();
            const itemKey = `timesetting-${labelText}-${item.milliseconds}`;
            const isSelected = autoLockMs === item.milliseconds;

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
        </View>
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
    // color: var(--r-neutral-title1, #192945);
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
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
