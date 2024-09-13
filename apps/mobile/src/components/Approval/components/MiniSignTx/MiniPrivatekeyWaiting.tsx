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

export const MiniPrivatekeyWaiting = ({
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

  const renderContent = useMemoizedFn(({ contentColor }) => (
    <View style={styles.contentWrapper}>
      <Text
        style={StyleSheet.flatten([
          styles.content,
          {
            color: colors[contentColor],
          },
        ])}>
        {error?.content}
      </Text>
    </View>
  ));

  return (
    <View>
      <ApprovalPopupContainer
        showAnimation
        hdType={'privatekey'}
        status={error?.status}
        onRetry={handleRetry}
        content={renderContent}
        description={error.description}
        onDone={onDone}
        onCancel={onCancel}
        hasMoreDescription={!!error.description}
      />
    </View>
  );
};
