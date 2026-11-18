import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
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
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { parsePerpsProTwapDuration } from '../../model/twapOrder';
import { PerpsProDialogBackdrop } from '../common/PerpsProDialogBackdrop';
import {
  getPerpsProDialogStyles,
  getPerpsProConfirmationFooterStyle,
} from '../common/perpsProDialogVisual';
import { usePerpsProSheetNavigationRegistration } from '../common/perpsProSheetNavigationRegistry';

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
    const { t } = useTranslation();
    const modal = useRef<AppBottomSheetModal>(null);
    const picker = useRef<React.ElementRef<typeof DurationPicker>>(null);
    const session = useRef(0);
    const request = useRef(0);
    const pending = useRef<number | null>(null);
    const open = useRef(visible);
    open.current = visible;
    const [draft, setDraft] = useState(value);
    const [sessionId, setSessionId] = useState(0);
    const [reading, setReading] = useState(false);
    const initial = useRef(value);
    initial.current = value;
    usePerpsProSheetNavigationRegistration({
      active: visible,
      dismiss: onClose,
    });
    useEffect(() => {
      pending.current = null;
      setReading(false);
      setSessionId(++session.current);
      if (visible) {
        setDraft(initial.current);
        modal.current?.present();
      } else modal.current?.close();
      return () => {
        pending.current = null;
      };
    }, [visible]);
    const error = parsePerpsProTwapDuration(draft).error;
    return (
      <AppBottomSheetModal
        ref={modal}
        onDismiss={onClose}
        enableDynamicSizing
        enableContentPanningGesture={false}
        {...makeBottomSheetProps({
          colors: colors2024,
          linearGradientType: 'bg0',
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
            <View style={styles.value}>
              <Text style={styles.valueText}>
                {draft ? `${draft} min` : t('page.perps.pro.twap.totalTime')}
              </Text>
            </View>
            <DurationPicker
              ref={picker}
              durationMinutes={Number(draft || 0)}
              sessionId={sessionId}
              dark={!isLight}
              style={styles.picker}
              onDurationChange={({ nativeEvent }) => {
                if (open.current && nativeEvent.sessionId === session.current)
                  setDraft(String(nativeEvent.minutes));
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
                setDraft(next);
                if (!parsePerpsProTwapDuration(next).error) {
                  onConfirm(next);
                  onClose();
                }
              }}
            />
            {draft && error ? (
              <Text style={styles.error}>
                {t(`page.perps.pro.twap.errors.${error}`)}
              </Text>
            ) : null}
            <View style={styles.footer}>
              <Button
                title={t('page.perps.pro.twap.reset')}
                type="ghost"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                containerStyle={styles.action}
                onPress={() => {
                  pending.current = null;
                  setReading(false);
                  setSessionId(++session.current);
                  setDraft('');
                }}
              />
              <Button
                title={t('global.confirm')}
                type="primary"
                height={BOTTOM_BUTTON_DOUBLE_HEIGHT}
                containerStyle={styles.action}
                buttonStyle={styles.button}
                titleStyle={styles.buttonTitle}
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
  ({ colors2024, isLight, safeAreaInsets }) => ({
    ...getPerpsProDialogStyles(colors2024, safeAreaInsets.bottom, isLight),
    container: { paddingHorizontal: 20, paddingTop: 8 },
    value: {
      height: 46,
      borderRadius: 6,
      backgroundColor: colors2024['neutral-bg-1'],
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 24,
    },
    valueText: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '500',
      color: colors2024['neutral-title-1'],
    },
    picker: { height: 216, width: '100%' },
    error: { fontSize: 13, lineHeight: 16, color: colors2024['red-default'] },
    footer: {
      ...getPerpsProConfirmationFooterStyle(safeAreaInsets.bottom),
      flexDirection: 'row',
      gap: BOTTOM_BUTTON_GAP,
    },
    action: { flex: 1 },
  }),
);
