import { notificationService } from '@/core/services';
import { useCommonPopupView } from '@/hooks/useCommonPopupView';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheetModalTitle } from '@/components/customized/BottomSheet';
import { CancelItem } from './CancelApproval/CancelItem';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

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

export const CancelConnect = () => {
  const { data } = useCommonPopupView();
  const { onCancel, displayBlockedRequestApproval } = data;
  const { t } = useTranslation();

  const handleBlockedRequestApproval = () => {
    notificationService.blockedDapp();
  };
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <BottomSheetView style={styles.wrapper}>
      <AppBottomSheetModalTitle
        title={t('page.signFooterBar.cancelConnection')}
      />
      <Text className="text-r-neutral-body text-13 font-normal text-center leading-[16px]">
        {t('page.signFooterBar.detectedMultipleRequestsFromThisDapp')}
      </Text>
      <View style={styles.buttonGroup}>
        <CancelItem onClick={onCancel}>
          {t('page.signFooterBar.cancelCurrentConnection')}
        </CancelItem>
        {displayBlockedRequestApproval && (
          <CancelItem onClick={handleBlockedRequestApproval}>
            {t('page.signFooterBar.blockDappFromSendingRequests')}
          </CancelItem>
        )}
      </View>
    </BottomSheetView>
  );
};
