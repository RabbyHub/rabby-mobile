import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMemoizedFn } from 'ahooks';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import IconDollar from '@/assets2024/icons/home/IconDollar.svg';

export const useTipsDollarDialog = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const showTipsDollarDialog = useMemoizedFn(() => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: t('page.copyTrading.tipsDollar.title'),
      titleStyle: {
        marginTop: 12,
        marginBottom: -12,
      },
      logoDom: (
        <View style={styles.dollarIconDialogContainer}>
          <IconDollar width={50} height={50} />
        </View>
      ),
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        snapPoints: [370],
      },
      sections: [
        {
          description: t('page.copyTrading.tipsDollar.description'),
        },
      ],
      nextButtonProps: {
        title: (
          <Text style={styles.modalNextButtonText}>
            {t('page.newAddress.whatIsSeedPhrase.GotIt')}
          </Text>
        ),
        titleStyle: StyleSheet.flatten([styles.modalNextButtonText]),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  });

  return {
    showTipsDollarDialog,
  };
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  dollarIconDialogContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNextButtonText: {
    color: colors2024['neutral-InvertHighlight'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    fontFamily: 'SF Pro Rounded',
  },
}));
