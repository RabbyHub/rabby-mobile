import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import {
  DurationPicker,
  DurationPickerCommands,
} from '@rabby-wallet/react-native-duration-picker';
import { AppBottomSheetModal } from '@/components/customized/BottomSheet';
import AutoLockView from '@/components/AutoLockView';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { makeBottomSheetProps } from '@/components2024/GlobalBottomSheetModal/utils-help';
import {
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_TOP_OFFSET,
  getBottomButtonBottomOffset,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  parsePerpsProTwapDuration,
  PERPS_PRO_TWAP_MAX_MINUTES,
  PERPS_PRO_TWAP_MIN_MINUTES,
} from '../../model/twapOrder';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import { PERPS_PRO_NUMBER_STYLE } from '../common/perpsProNumberText';
import {
  getPerpsProInputDialogStyles,
  resolvePerpsProDialogFieldBackground,
} from '../common/perpsProDialogVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';
import { usePerpsProSliderHaptics } from '../common/usePerpsProSliderHaptics';

const initialDuration = (value: string) =>
  String(
    parsePerpsProTwapDuration(value).minutes ?? PERPS_PRO_TWAP_MIN_MINUTES,
  );

export const PerpsProTwapDurationSheet = React.memo(
  ({
    value,
    visible,
    onClose,
    onConfirm,
  }: {
    value: string;
    visible: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
  }) => {
    const { styles, colors2024, isLight } = useTheme2024({ getStyle });
    const { t, i18n } = useTranslation();
    const modal = useRef<AppBottomSheetModal>(null);
    const picker = useRef<React.ElementRef<typeof DurationPicker>>(null);
    const session = useRef(0);
    const request = useRef(0);
    const pending = useRef<number | null>(null);
    const open = useRef(visible);
    open.current = visible;
    const [draft, setDraft] = useState(() => initialDuration(value));
    const [sessionId, setSessionId] = useState(0);
    const [reading, setReading] = useState(false);
    const totalMinutes = Number(draft);
    const {
      onValueChange: onUserDurationChange,
      onSlidingComplete: resetHaptics,
    } = usePerpsProSliderHaptics({
      disabled: !visible || reading,
      minimumValue: PERPS_PRO_TWAP_MIN_MINUTES,
      maximumValue: PERPS_PRO_TWAP_MAX_MINUTES,
      value: totalMinutes,
    });
    const initial = useRef(value);
    initial.current = value;
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
    });
    useEffect(() => {
      pending.current = null;
      resetHaptics();
      setReading(false);
      setSessionId(++session.current);
      if (visible) {
        setDraft(initialDuration(initial.current));
        modal.current?.present();
      } else modal.current?.close();
      return () => {
        pending.current = null;
      };
    }, [visible, resetHaptics]);
    const hours = Math.floor(totalMinutes / 60);
    const minuteLabels = useMemo(
      () =>
        Array.from({ length: 60 }, (_, count) =>
          t('page.perps.pro.twap.minuteValue', { count, t: count }),
        ),
      [t],
    );
    const renderValue = (
      amount: number,
      unitKey: 'global.time.hours' | 'page.perps.pro.twap.minuteValue',
    ) => {
      const key =
        unitKey === 'global.time.hours' && amount === 1
          ? 'global.time.hour'
          : unitKey;
      // A figure space occupies the same width as one tabular digit.
      const digits = String(amount).padStart(2, '\u2007');
      return (
        <View style={styles.value}>
          {draft ? (
            <View>
              {/* Reserve the same centered width for both "hour" and "hours". */}
              <Text
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[styles.valueText, styles.measureText]}>
                {t(unitKey, { count: 2, t: '00' })}
              </Text>
              <Text style={[styles.valueText, styles.positionedText]}>
                {t(key, { count: amount, t: digits })}
              </Text>
            </View>
          ) : (
            <Text style={styles.valueText}>{t(unitKey, { t: '' }).trim()}</Text>
          )}
        </View>
      );
    };
    return (
      <AppBottomSheetModal
        ref={modal}
        onDismiss={onClose}
        enableDynamicSizing
        enableContentPanningGesture={false}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg1',
        })}
        backdropComponent={PerpsProDialogBackdrop}
        backgroundStyle={styles.background}
        handleStyle={styles.handle}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.modal}>
        <BottomSheetView>
          <AutoLockView style={styles.container}>
            <Text style={styles.title}>
              {t('page.perps.pro.twap.selectTime')}
            </Text>
            <View style={styles.values}>
              {renderValue(hours, 'global.time.hours')}
              <Text style={styles.valueText}>：</Text>
              {renderValue(
                totalMinutes % 60,
                'page.perps.pro.twap.minuteValue',
              )}
            </View>
            <DurationPicker
              ref={picker}
              durationMinutes={totalMinutes}
              minimumDurationMinutes={PERPS_PRO_TWAP_MIN_MINUTES}
              minuteLabels={minuteLabels}
              androidLocale={
                Platform.OS === 'android' ? i18n.language : undefined
              }
              sessionId={sessionId}
              dark={!isLight}
              style={styles.picker}
              onDurationChange={({ nativeEvent }) => {
                if (open.current && nativeEvent.sessionId === session.current) {
                  onUserDurationChange(nativeEvent.minutes);
                  setDraft(String(nativeEvent.minutes));
                }
              }}
              onValueRead={({ nativeEvent }) => {
                if (
                  !open.current ||
                  nativeEvent.sessionId !== session.current ||
                  pending.current !== nativeEvent.requestId
                )
                  return;
                pending.current = null;
                setReading(false);
                const next = String(nativeEvent.minutes);
                resetHaptics();
                setDraft(next);
                if (!parsePerpsProTwapDuration(next).error) {
                  onConfirm(next);
                  onClose();
                }
              }}
            />
            <View style={styles.footer}>
              <Button
                title={t('page.perps.pro.twap.reset')}
                type="plain"
                titleStyle={styles.actionTitle}
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                containerStyle={styles.action}
                onPress={() => {
                  pending.current = null;
                  resetHaptics();
                  setReading(false);
                  setSessionId(++session.current);
                  setDraft(String(PERPS_PRO_TWAP_MIN_MINUTES));
                }}
              />
              <Button
                title={t('global.confirm')}
                type="hyperliquid"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                containerStyle={styles.action}
                buttonStyle={styles.confirmButton}
                titleStyle={isLight ? styles.actionTitle : undefined}
                loading={reading}
                disabled={reading}
                onPress={() => {
                  if (!picker.current || pending.current !== null) return;
                  const id = ++request.current;
                  pending.current = id;
                  setReading(true);
                  DurationPickerCommands.readCurrentValue(picker.current, id);
                }}
              />
            </View>
          </AutoLockView>
        </BottomSheetView>
      </AppBottomSheetModal>
    );
  },
);
PerpsProTwapDurationSheet.displayName = 'PerpsProTwapDurationSheet';
const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => {
    const dialog = getPerpsProInputDialogStyles(
      colors2024,
      safeAreaInsets.bottom,
      isLight,
    );
    return {
      ...dialog,
      container: { paddingTop: 8 },
      values: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        marginTop: 16,
      },
      value: {
        flex: 1,
        height: 46,
        borderRadius: 6,
        backgroundColor: resolvePerpsProDialogFieldBackground(
          colors2024,
          isLight,
        ),
        alignItems: 'center',
        justifyContent: 'center',
      },
      valueText: {
        ...PERPS_PRO_NUMBER_STYLE,
        fontFamily: 'SF Pro Rounded',
        fontSize: 14,
        lineHeight: 18,
        fontWeight: '500',
        includeFontPadding: false,
        color: colors2024['neutral-title-1'],
      },
      measureText: { opacity: 0 },
      positionedText: { position: 'absolute', left: 0, top: 0 },
      picker: {
        marginTop: 16,
        width: '100%',
        aspectRatio: 650 / 228,
        maxHeight: 216,
      },
      footer: {
        marginTop: 22,
        paddingTop: BOTTOM_BUTTON_TOP_OFFSET,
        paddingBottom: getBottomButtonBottomOffset(safeAreaInsets.bottom) + 2,
        paddingLeft: 20,
        paddingRight: 18,
        flexDirection: 'row',
        gap: BOTTOM_BUTTON_GAP,
      },
      action: { flex: 1 },
      confirmButton: {
        shadowColor: dialog.button.shadowColor,
        shadowOffset: dialog.button.shadowOffset,
        shadowOpacity: dialog.button.shadowOpacity,
        shadowRadius: dialog.button.shadowRadius,
        elevation: dialog.button.elevation,
      },
      actionTitle: { color: colors2024['neutral-body'] },
    };
  },
);
