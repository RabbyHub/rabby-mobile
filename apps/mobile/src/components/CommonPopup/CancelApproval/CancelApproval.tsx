import React from 'react';
import { CancelItem } from './CancelItem';
import { useTranslation } from 'react-i18next';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { notificationService } from '@/core/services';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import AutoLockView from '@/components/AutoLockView';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      paddingHorizontal: 20,
    },
    title: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
      textAlign: 'center',
    },
    buttonGroup: {
      rowGap: 10,
      marginTop: 20,
    },
  });

export const CancelApproval = () => {
  const { data, closePopup } = useCommonPopupView();
  const { onCancel, displayBlockedRequestApproval, displayCancelAllApproval } =
    data;
  const [pendingApprovalCount, setPendingApprovalCount] = React.useState(0);
  const { t } = useTranslation();

  React.useEffect(() => {
    setPendingApprovalCount(notificationService.approvals.length);
  }, [displayBlockedRequestApproval, displayCancelAllApproval]);

  const handleCancelAll = () => {
    notificationService.rejectAllApprovals();
    handleCancel();
  };

  const handleBlockedRequestApproval = () => {
    closePopup();
    notificationService.blockedDapp();
    onCancel();
  };

  const handleCancel = () => {
    onCancel();
    closePopup();
  };
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <AutoLockView as="BottomSheetView" style={styles.wrapper}>
      <AppBottomSheetModalTitle
        title={t('page.signFooterBar.cancelTransaction')}
      />
      <Text style={styles.title}>
        {t('page.signFooterBar.detectedMultipleRequestsFromThisDapp')}
      </Text>
      <View style={styles.buttonGroup}>
        <CancelItem onClick={handleCancel}>
          {t('page.signFooterBar.cancelCurrentTransaction')}
        </CancelItem>
        {displayCancelAllApproval && (
          <CancelItem onClick={handleCancelAll}>
            {t('page.signFooterBar.cancelAll', {
              count: pendingApprovalCount,
            })}
          </CancelItem>
        )}
        {displayBlockedRequestApproval && (
          <CancelItem onClick={handleBlockedRequestApproval}>
            {t('page.signFooterBar.blockDappFromSendingRequests')}
          </CancelItem>
        )}
      </View>
    </AutoLockView>
  );
};
