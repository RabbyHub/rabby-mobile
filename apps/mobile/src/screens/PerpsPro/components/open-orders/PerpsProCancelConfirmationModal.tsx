import {
  BOTTOM_BUTTON_SINGLE_HEIGHT,
  BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
} from '@/constant/layout';
import { getPerpsProDialogActionStyles } from '../common/perpsProDialogVisual';
import RcIconWarningCircleCC from '@/assets2024/icons/common/warning-circle-cc.svg';
import { TrackedModal } from '@/components/Modal/TrackedModal';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { MODAL_GATE_IDS } from '@/utils/modalGate';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProCancelConfirmation } from '../../scene/usePerpsProCancelOrders';

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
            <RcIconWarningCircleCC
              color={colors2024['orange-default']}
              height={48}
              width={48}
            />
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
                styles.actionLayout,
                styles.button,
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
    paddingHorizontal: 24,
  },
  backdrop: {
    backgroundColor: colors2024['neutral-black'],
    bottom: 0,
    left: 0,
    opacity: 0.6,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 12,
    gap: 24,
    padding: 24,
    width: 297,
  },
  content: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
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
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'left',
    width: '100%',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  actionLayout: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    height: BOTTOM_BUTTON_SINGLE_HEIGHT,
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors2024['neutral-bg-2'],
  },
  cancelText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  confirmText: {
    lineHeight: BOTTOM_BUTTON_TEXT_LINE_HEIGHT,
  },
  pressed: {
    opacity: 0.8,
  },
}));
