import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeStyles } from '@/hooks/theme';
import { Button } from '@/components';

export default function ModalConfirmDiscard({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const { styles } = useThemeStyles(getStyles);

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      visible={visible}
      style={styles.modal}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {t('component.Contact.EditWhitelist.backModalTitle')}
          </Text>
          <Text style={styles.body}>
            {t('component.Contact.EditWhitelist.backModalContent')}
          </Text>

          <View style={styles.buttonGroup}>
            <Button
              title={t('global.Cancel')}
              containerStyle={styles.btnContainer}
              buttonStyle={styles.cancelStyle}
              titleStyle={styles.cancelTitleStyle}
              onPress={onCancel}
            />
            <View style={styles.btnGap} />

            <Button
              title={t('global.Confirm')}
              containerStyle={styles.btnContainer}
              buttonStyle={styles.confirmStyle}
              titleStyle={styles.confirmTitleStyle}
              onPress={onConfirm}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
  buttonGroup: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: colors['neutral-line'],
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    marginTop: 40,
  },

  btnContainer: {
    flex: 1,
    height: 50,
  },

  cancelStyle: {
    backgroundColor: colors['neutral-card-1'],
    borderColor: colors['blue-default'],
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 8,
    height: '100%',
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
    height: '100%',
  },
  confirmTitleStyle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '500',
    color: colors['neutral-title2'],
    flex: 1,
  },
}));
