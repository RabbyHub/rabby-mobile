import RcIconCloseCC from '@/assets/icons/common/icon-close-cc.svg';
import { Button } from '@/components';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Dialog } from '@rneui/themed';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export const BlockedAddressDialog = ({
  visible,
  onConfirm,
}: {
  visible: boolean;
  onConfirm?(): void;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Dialog
      overlayStyle={styles.dialog}
      backdropStyle={styles.dialogMask}
      isVisible={visible}>
      <View>
        <View style={styles.dialogHeader}>
          <Text style={styles.dialogTitle}>
            {t('common.dialogs.blockedTransaction.title')}
          </Text>
        </View>
        <View style={styles.dialogBody}>
          <Text style={styles.dialogContent}>
            {t('common.dialogs.blockedTransaction.content')}
          </Text>
        </View>
        <View style={styles.dialogFooter}>
          <Button
            type="primary"
            className="w-[172px]"
            onPress={onConfirm}
            title={t('common.dialogs.blockedTransaction.button')}
            containerStyle={styles.button}
          />
        </View>
      </View>
    </Dialog>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    dialog: {
      borderRadius: 16,
      padding: 0,
      backgroundColor: colors['neutral-bg-1'],
      width: 353,
      maxWidth: '100%',
    },
    dialogMask: {
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    dialogHeader: {
      paddingHorizontal: 20,
      paddingTop: 20,
      marginBottom: 12,
      position: 'relative',
    },
    closeIcon: {
      position: 'absolute',
      right: 20,
      top: 24,
      zIndex: 1,
    },
    dialogTitle: {
      color: colors['neutral-title-1'],
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
      textAlign: 'center',
    },
    dialogBody: {
      paddingHorizontal: 20,
    },
    dialogContent: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '400',
      textAlign: 'center',
      marginBottom: 26,
    },
    dialogFooter: {
      paddingHorizontal: 20,
      paddingBottom: 20,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    button: {
      flex: 1,
    },
  });
