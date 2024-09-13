import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { toast } from '@/components/Toast';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ApprovalPopupContainer } from '../Popup/ApprovalPopupContainer';
import { BatchSignTxTaskType } from './useBatchSignTxTask';

interface Props {
  onCancel?: () => void;
  onRetry?: () => void;
  onDone?: () => void;
  error: NonNullable<BatchSignTxTaskType['error']>;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    brandIcon: {
      width: 20,
      height: 20,
      marginRight: 6,
    },
    titleWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      justifyContent: 'center',
      marginTop: 15,
    },
    title: {
      fontSize: 16,
      fontWeight: '500',
      color: colors['neutral-title-1'],
    },
    content: {
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  });

export const MiniLedgerHardwareWaiting = ({
  onCancel,
  onDone,
  onRetry,
  error,
}: Props) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { t } = useTranslation();

  const handleRetry = async () => {
    toast.success(t('page.signFooterBar.ledger.resent'));
    onRetry?.();
  };

  const currentDescription = React.useMemo(() => {
    const description = error.description;
    if (description?.includes('0x650f')) {
      return t('page.newAddress.ledger.error.lockedOrNoEthApp');
    }
    if (description?.includes('0x5515') || description?.includes('0x6b0c')) {
      return t('page.signFooterBar.ledger.unlockAlert');
    } else if (
      description?.includes('0x6e00') ||
      description?.includes('0x6b00')
    ) {
      return t('page.signFooterBar.ledger.updateFirmwareAlert');
    } else if (description?.includes('0x6985')) {
      return t('page.signFooterBar.ledger.txRejectedByLedger');
    }

    return description;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error.description]);

  const renderContent = useMemoizedFn(({ contentColor }) => (
    <View style={styles.contentWrapper}>
      <Text
        style={StyleSheet.flatten([
          styles.content,
          {
            color: colors[contentColor],
          },
        ])}>
        {error.content}
      </Text>
    </View>
  ));

  return (
    <View>
      <View style={styles.titleWrapper}>
        <LedgerSVG width={20} height={20} style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', { brand: 'Ledger' })}
        </Text>
      </View>

      <ApprovalPopupContainer
        showAnimation
        hdType="ledger"
        status={error.status}
        onRetry={() => handleRetry()}
        onDone={onDone}
        onCancel={onCancel}
        description={currentDescription}
        content={renderContent}
        hasMoreDescription={
          error.status === 'REJECTED' || error.status === 'FAILED'
        }
      />
    </View>
  );
};
