import LedgerSVG from '@/assets/icons/wallet/ledger.svg';
import { toast } from '@/components/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { MiniApprovalTaskType } from '@/hooks/useMiniApprovalTask';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { MiniApprovalPopupContainer } from '../Popup/MiniApprovalPopupContainer';
import {
  getTxFailedResult,
  RetryUpdateType,
  setRetryTxType,
} from '@/utils/errorTxRetry';

interface Props {
  onCancel?: () => void;
  onRetry?: () => void;
  onDone?: () => void;
  error: NonNullable<MiniApprovalTaskType['error']>;
}

const getStyle = createGetStyles2024(({ colors2024 }) =>
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
      color: colors2024['neutral-title-1'],
    },
    content: {
      fontSize: 20,
      textAlign: 'center',
      fontFamily: 'SF Pro Rounded',
      fontWeight: '900',
      lineHeight: 24,
      color: colors2024['red-default'],
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  }),
);
export const MiniLedgerHardwareWaiting = ({
  onCancel,
  onDone,
  onRetry,
  error,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  const [currentDescription, retryUpdateType]: [string, RetryUpdateType] =
    React.useMemo(() => {
      const description = error.description;
      if (description?.includes('0x650f')) {
        return [t('page.newAddress.ledger.error.lockedOrNoEthApp'), 'origin'];
      }
      if (description?.includes('0x5515') || description?.includes('0x6b0c')) {
        return [t('page.signFooterBar.ledger.unlockAlert'), 'origin'];
      } else if (
        description?.includes('0x6e00') ||
        description?.includes('0x6b00')
      ) {
        return [t('page.signFooterBar.ledger.updateFirmwareAlert'), 'origin'];
      } else if (description?.includes('0x6985')) {
        return [t('page.signFooterBar.ledger.txRejectedByLedger'), 'origin'];
      }

      return getTxFailedResult(error.description || '');
      // return description;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error.description]);

  const handleRetry = async () => {
    // toast.success(t('page.signFooterBar.ledger.resent'));
    setRetryTxType(retryUpdateType);
    onRetry?.();
  };

  const renderContent = useMemoizedFn(({ contentColor }) => (
    <View style={styles.contentWrapper}>
      <Text
        style={StyleSheet.flatten([
          styles.content,
          {
            color: colors2024[contentColor],
          },
        ])}>
        {error.content} {retryUpdateType ? ': Please Retry' : ''}
      </Text>
    </View>
  ));

  return (
    <View>
      {/* <View style={styles.titleWrapper}>
        <LedgerSVG width={20} height={20} style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', { brand: 'Ledger' })}
        </Text>
      </View> */}

      <MiniApprovalPopupContainer
        showAnimation
        hdType="ledger"
        status={error.status}
        onRetry={() => handleRetry()}
        onDone={onDone}
        onCancel={onCancel}
        description={currentDescription}
        BrandIcon={LedgerSVG}
        content={renderContent}
        hasMoreDescription={
          error.status === 'REJECTED' || error.status === 'FAILED'
        }
        retryUpdateType={retryUpdateType}
      />
    </View>
  );
};
