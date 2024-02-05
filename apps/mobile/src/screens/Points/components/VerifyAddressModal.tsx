import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Button } from '@/components';

export const ClaimRabbyVerifyModal = ({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      style={styles.modal}>
      <View style={styles.overlay}>
        <Inner onCancel={onCancel} onConfirm={onConfirm} />
      </View>
    </Modal>
  );
};

const Inner = ({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {t('page.rabbyPoints.referralCode.verifyAddressModal.verify-address')}
      </Text>
      <Text style={styles.body}>
        {t(
          'page.rabbyPoints.referralCode.verifyAddressModal.please-sign-this-text-message-to-verify-that-you-are-the-owner-of-this-address',
        )}
      </Text>

      <View style={styles.buttonContainer}>
        <Button
          title={t('page.rabbyPoints.referralCode.verifyAddressModal.cancel')}
          containerStyle={styles.btnC}
          buttonStyle={styles.cancelStyle}
          titleStyle={styles.cancelTitleStyle}
          onPress={onCancel}
        />
        <View style={styles.btnGap} />

        <Button
          title={t('page.rabbyPoints.referralCode.verifyAddressModal.sign')}
          containerStyle={styles.btnC}
          buttonStyle={styles.confirmStyle}
          titleStyle={styles.confirmTitleStyle}
          onPress={onConfirm}
        />
      </View>
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  modal: { maxWidth: 353, width: '100%' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    maxWidth: 350,
    marginHorizontal: 20,
    backgroundColor: colors['neutral-bg1'],
    paddingVertical: 20,
    borderRadius: 16,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    color: colors['neutral-title1'],
    fontWeight: '500',
    textAlign: 'center',
  },
  body: {
    paddingHorizontal: 20,
    marginTop: 12,
    fontSize: 14,
    color: colors['neutral-body'],
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 40,
  },

  btnC: {
    flex: 1,
    height: 50,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: 48,
    width: '100%',
  },
  cancelTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['blue-default'],
    flex: 1,
  },
  btnGap: {
    width: 13,
  },
  confirmStyle: {
    backgroundColor: colors['blue-default'],
    borderRadius: 8,
    width: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
