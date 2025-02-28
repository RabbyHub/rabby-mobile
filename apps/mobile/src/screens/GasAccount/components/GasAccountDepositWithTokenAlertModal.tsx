import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

interface Props {
  visible: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
}

export const GasAccountDepositWithTokenAlertModal: React.FC<Props> = ({
  visible,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({
    getStyle,
  });

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          <Text style={styles.description}>
            To complete the GasAccount deposit, this transaction will be
            discarded. You’ll need to remake it after the deposit.
          </Text>
          <View style={styles.footer}>
            <Button
              type="ghost"
              title={t('global.cancel')}
              onPress={onCancel}
              containerStyle={styles.containerStyle}
            />
            <Button
              type="primary"
              title={t('global.ok')}
              onPress={onConfirm}
              containerStyle={styles.containerStyle}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    maxWidth: 352,
    backgroundColor: colors2024['neutral-bg-1'],
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },

  footer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },

  description: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontStyle: 'normal',
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    marginBottom: 20,
    textAlign: 'center',
  },
  accountContainer: {
    marginHorizontal: 5,
    marginBottom: 28,
    alignSelf: 'stretch',
  },

  containerStyle: {
    // width: '100%',
    // height: 40,
    height: 48,
    flex: 1,
  },
  buttonStyle: {},
}));
