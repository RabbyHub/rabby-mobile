import { Button } from '@/components';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { Dialog } from '@rneui/themed';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Typography';

export const ConfirmModifyRpcModal = ({
  visible,
  onCancel,
  onConfirm,
  chainId,
  rpcUrl,
}: {
  visible: boolean;
  onCancel(): void;
  onConfirm(): void;
  chainId?: number;
  rpcUrl?: string;
}) => {
  const { t } = useTranslation();
  const chain = useMemo(() => {
    if (!chainId) {
      return null;
    }
    return findChain({
      id: chainId,
    });
  }, [chainId]);

  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <Dialog
      overlayStyle={styles.dialog}
      backdropStyle={styles.dialogMask}
      onBackdropPress={() => {
        onCancel?.();
      }}
      isVisible={visible}>
      <View>
        <View style={styles.dialogBody}>
          <Text style={styles.dialogContent}>
            {t('page.customTestnet.ConfirmModifyRpcModal.desc')}
          </Text>
          <View style={styles.chainInfo}>
            <ChainIconImage
              chainId={chainId}
              size={32}
              style={styles.chainIcon}
            />
            <Text style={styles.chainName}>{chain?.name}</Text>
            <Text style={styles.rpcUrl}>{rpcUrl}</Text>
          </View>
        </View>
        <View style={styles.dialogFooter}>
          <Button
            type="primary"
            ghost
            onPress={onCancel}
            title={t('global.Cancel')}
            containerStyle={styles.button}
          />
          <Button
            type="primary"
            className="w-[172px]"
            onPress={onConfirm}
            title={t('global.Confirm')}
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
      marginBottom: 16,
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
      paddingTop: 20,
      paddingBottom: 27,
    },
    dialogContent: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 22,
    },
    dialogFooter: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors['neutral-line'],
      padding: 20,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    button: {
      flex: 1,
    },
    chainInfo: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    chainIcon: {
      marginBottom: 12,
    },
    chainName: {
      color: colors['neutral-title-1'],
      fontSize: 16,
      lineHeight: 19,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 6,
    },
    rpcUrl: {
      color: colors['neutral-body'],
      fontSize: 14,
      lineHeight: 17,
    },
  });
