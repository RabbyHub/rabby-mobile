import {
  forwardRef,
  useRef,
  useMemo,
  useImperativeHandle,
  useCallback,
} from 'react';
import { Text, View, StyleSheet, StyleProp, TextStyle } from 'react-native';

import { AppBottomSheetModal, Button } from '@/components';
import { useThemeColors } from '@/hooks/theme';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { createGetStyles, makeDebugBorder } from '@/utils/styles';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { TIME_SETTINGS } from '@/constant/autoLock';
import { RcIconCheckmarkCC } from '@/assets/icons/common';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import TouchableView from '@/components/Touchable/TouchableView';
import { useAutoLockTimeMs } from '@/hooks/appSettings';
import { IS_ANDROID } from '@/core/native/utils';

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

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

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
      backgroundStyle={styles.sheet}
      index={0}
      ref={sheetModalRef}
      handleStyle={styles.handleStyle}
      snapPoints={[safeSizes.sheetHeight]}
      onChange={index => {
        if (index <= 0) {
          onCancel?.();
        }
      }}>
      <BottomSheetView
        // scrollEnabled={false}
        style={[
          styles.container,
          {
            paddingBottom: safeSizes.containerPaddingBottom,
          },
        ]}>
        <Text style={styles.title}>Auto lock time</Text>
        <View style={styles.mainContainer}>
          {TIME_SETTINGS.map((item, idx) => {
            const itemKey = `timesetting-${item.label}-${item.milliseconds}`;
            const isSelected = autoLockMs === item.milliseconds;

            return (
              <TouchableView
                style={[styles.settingItem, idx > 0 && styles.notFirstOne]}
                key={itemKey}
                onPress={() => {
                  handleConfirm(item.milliseconds);
                }}>
                <Text style={styles.settingItemLabel}>{item.label}</Text>
                {isSelected && (
                  <View>
                    <RcIconCheckmark style={{ width: 24, height: 24 }} />
                  </View>
                )}
              </TouchableView>
            );
          })}
        </View>
      </BottomSheetView>
    </AppBottomSheetModal>
  );
});

const getStyles = createGetStyles((colors, options) => ({
  sheet: {
    // backgroundColor: colors['neutral-bg-1'],
    backgroundColor: colors['neutral-bg-2'],
    // height: SIZES.FULL_HEIGHT,
  },
  handleStyle: {
    height: SIZES.HANDLE_HEIGHT,
    backgroundColor: colors['neutral-bg-2'],
    // ...makeDebugBorder(),
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
    // height: SIZES.CONTENT_HEIGHT,
    // ...makeDebugBorder('yellow'),
  },
  title: {
    fontSize: 24,
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
    backgroundColor: !options?.isLight
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
    // color: var(--r-neutral-title1, #192945);
    color: colors['neutral-title-1'],
    fontSize: 16,
    fontStyle: 'normal',
    fontWeight: '500',
  },

  border: {
    height: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors['neutral-bg1'],
    position: 'absolute',
    top: 0,
    left: 0,
  },
}));
