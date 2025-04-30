import { toast } from '@/components/Toast';
import { useTheme2024 } from '@/hooks/theme';
import { MiniApprovalTaskType } from '@/hooks/useMiniApprovalTask';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { ApprovalPopupContainer } from '../Popup/ApprovalPopupContainer';
import { MiniApprovalPopupContainer } from '../Popup/MiniApprovalPopupContainer';

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

export const MiniPrivatekeyWaiting = ({
  onCancel,
  onDone,
  onRetry,
  error,
}: Props) => {
  const { styles, colors } = useTheme2024({
    getStyle,
  });
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
      <MiniApprovalPopupContainer
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
