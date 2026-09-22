import { BOTTOM_BUTTON_GAP } from '@/constant/layout';
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

import type { PerpsProCancelConfirmation } from '../../scene/usePerpsProCancelOrders';

// Figma 84231:25827 uses compact modal actions, as does Close All Positions.
const CANCEL_ACTION_HEIGHT = 40;

export const PerpsProCancelConfirmationModal: React.FC<{
  confirmation: PerpsProCancelConfirmation | null;
  onCancel: () => void;
  onConfirm: () => void;
}> = React.memo(({ confirmation, onCancel, onConfirm }) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  return (
    <TrackedModal
      animationType="fade"
      modalId={MODAL_GATE_IDS.perpsProCancelConfirmation}
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
              <Text style={styles.title}>{confirmation?.title ?? ''}</Text>
              <Text style={styles.message}>{confirmation?.message ?? ''}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
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
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                styles.actionLayout,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.buttonTitle, styles.confirmText]}>
                {t('global.confirm')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </TrackedModal>
  );
});

PerpsProCancelConfirmationModal.displayName = 'PerpsProCancelConfirmationModal';

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
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    width: '100%',
  },
  message: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'left',
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
