import {
  BOTTOM_BUTTON_GAP,
  BOTTOM_BUTTON_DOUBLE_HEIGHT,
} from '@/constant/layout';
import { getPerpsProDialogActionStyles } from '../common/perpsProDialogVisual';
import RcIconWarningCircleCC from '@/assets2024/icons/perps/PerpsProCloseAllWarning.svg';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProCancelTwapCommand } from '../../actions/cancelTwap';

// Figma 84231:25827 uses compact modal actions, as does Close All Positions.
// Figma 86609:313792: 48pt actions and a secondary-color message.
const CANCEL_ACTION_HEIGHT = BOTTOM_BUTTON_DOUBLE_HEIGHT;

export const PerpsProEndTwapModal: React.FC<{
  confirmation: PerpsProCancelTwapCommand | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}> = React.memo(({ confirmation, onCancel, onConfirm, pending }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <TrackedModal
      animationType="fade"
      modalId={MODAL_GATE_IDS.perpsProEndTwap}
      onRequestClose={onCancel}
      transparent
      visible={!!confirmation}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.backdrop} />
        <View style={styles.card}>
          <View
            style={styles.content}
            testID="perps-pro-cancel-confirmation-content">
            <View style={styles.warning}>
              <RcIconWarningCircleCC
                color={colors2024['orange-default']}
                height={37.3333}
                width={37.3333}
              />
            </View>
            <View
              style={styles.copy}
              testID="perps-pro-cancel-confirmation-copy">
              <Text style={styles.title}>
                {t('page.perps.pro.twap.endTitle')}
              </Text>
              <Text style={styles.message}>
                {t('page.perps.pro.twap.endMessage')}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.actionLayout,
                styles.cancelButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.cancelText}>{t('global.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={pending}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.actionLayout,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.buttonTitle, styles.confirmText]}>
                {pending
                  ? t('page.perps.pro.twap.ending')
                  : t('global.confirm')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </TrackedModal>
  );
});

PerpsProEndTwapModal.displayName = 'PerpsProEndTwapModal';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  ...getPerpsProDialogActionStyles(colors2024),
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    backgroundColor: colors2024['neutral-black'],
    bottom: 0,
    left: 0,
    opacity: 0.3,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    gap: 16,
    padding: 24,
    width: '100%',
    maxWidth: 353,
  },
  content: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  warning: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    width: '100%',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    textAlign: 'center',
    width: '100%',
  },
  message: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: BOTTOM_BUTTON_GAP,
    width: '100%',
  },
  actionLayout: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    height: CANCEL_ACTION_HEIGHT,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors2024['neutral-bg-5'],
  },
  cancelText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  confirmText: {
    fontSize: 16,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.8,
  },
}));
