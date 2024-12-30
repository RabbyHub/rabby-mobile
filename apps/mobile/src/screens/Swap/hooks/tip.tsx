import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

export const useSwapBottomModalTips = () => {
  const { t } = useTranslation();

  const { styles } = useTheme2024({ getStyle });

  const showTips = (tips: React.ReactNode) => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: tips,
      sections: [],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: ['30%'],
      },
      nextButtonProps: {
        title: (
          <Text style={styles.closeModalBtnText}>
            {t('page.tokenDetail.excludeBalanceTipsButton')}
          </Text>
        ),
        titleStyle: styles.title,
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
      },
    });
  };

  return showTips;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  title: {
    fontSize: 17,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  closeModalBtnText: {
    fontSize: 20,
    color: colors2024['neutral-InvertHighlight'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
