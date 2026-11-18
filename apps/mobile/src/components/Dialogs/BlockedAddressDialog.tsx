import { Button } from '@/components2024/Button';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Dialog } from '@rneui/themed';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Text } from '@/components/Typography';

export const BlockedAddressDialog = ({
  visible,
  onConfirm,
}: {
  visible: boolean;
  onConfirm?(): void;
}) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle });

  return (
    <Dialog
      overlayStyle={styles.dialog}
      backdropStyle={styles.dialogMask}
      isVisible={visible}>
      <View>
        <Text style={styles.dialogTitle}>
          {t('common.dialogs.blockedTransaction.title')}
        </Text>
        <Text style={styles.dialogContent}>
          {t('common.dialogs.blockedTransaction.content')}
        </Text>
        <Button
          type="primary"
          height={56}
          onPress={onConfirm}
          title={t('common.dialogs.blockedTransaction.button')}
        />
      </View>
    </Dialog>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  dialog: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    width: 353,
    maxWidth: '100%',
  },
  dialogMask: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  dialogTitle: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 24,
    textAlign: 'center',
  },
  dialogContent: {
    marginTop: 12,
    marginBottom: 24,
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
}));
