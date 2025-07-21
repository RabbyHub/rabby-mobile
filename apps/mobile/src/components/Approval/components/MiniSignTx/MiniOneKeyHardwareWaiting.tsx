import OneKeySVG from '@/assets/icons/wallet/onekey.svg';
import { toast } from '@/components/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { MiniApprovalTaskType } from '@/hooks/useMiniApprovalTask';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { MiniApprovalPopupContainer } from '../Popup/MiniApprovalPopupContainer';
import { getTxFailedResult, setRetryTxType } from '@/utils/errorTxRetry';

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
      fontWeight: '700',
      lineHeight: 24,
      color: colors2024['red-default'],
    },
    contentWrapper: {
      flexDirection: 'row',
    },
  }),
);

export const MiniOneKeyHardwareWaiting = ({
  onCancel,
  onDone,
  onRetry,
  error,
}: Props) => {
  const { styles, colors2024 } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();

  const handleRetry = async () => {
    // toast.success(t('page.signFooterBar.ledger.resent'));
    setRetryTxType(retryUpdateType);
    onRetry?.();
  };

  const [currentDescription, retryUpdateType] = React.useMemo(() => {
    const description = getTxFailedResult(error.description || '');
    return description;
  }, [error.description]);

  const renderContent = React.useCallback(
    ({ contentColor }) => (
      <View style={styles.contentWrapper}>
        <Text
          style={StyleSheet.flatten([
            styles.content,
            {
              color: colors2024[contentColor],
            },
          ])}>
          {error.content}
        </Text>
      </View>
    ),
    [colors2024, error.content, styles.content, styles.contentWrapper],
  );

  return (
    <View>
      {/* <View style={styles.titleWrapper}>
        <OneKeySVG width={20} height={20} style={styles.brandIcon} />
        <Text style={styles.title}>
          {t('page.signFooterBar.qrcode.signWith', { brand: 'OneKey' })}
        </Text>
      </View> */}

      <MiniApprovalPopupContainer
        showAnimation
        hdType="onekey"
        status={error.status}
        onRetry={() => handleRetry()}
        onDone={onDone}
        onCancel={onCancel}
        description={currentDescription}
        content={renderContent}
        BrandIcon={OneKeySVG}
        hasMoreDescription={
          error.status === 'REJECTED' || error.status === 'FAILED'
        }
        retryUpdateType={retryUpdateType}
      />
    </View>
  );
};
