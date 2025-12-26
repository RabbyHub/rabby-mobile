import React from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable, Text } from 'react-native';
import RcInfoFillCC from '@/assets/icons/common/icon-info-fill-cc.svg.svg';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';

const IsolatedTag = ({
  disablePress,
  isGlobal,
}: {
  disablePress?: boolean;
  isGlobal?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const handleShow = () => {
    const modalId = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.DESCRIPTION,
      title: isGlobal ? undefined : t('page.Lending.modalDesc.isolatedTitle'),
      titleStyle: {
        marginTop: 12,
        fontWeight: '900',
      },
      sectionStyle: {
        marginTop: 8,
      },
      sectionDescStyle: {
        lineHeight: 20,
      },
      sections: [
        {
          description: isGlobal
            ? t('page.Lending.modalDesc.globalIsolatedDesc')
            : t('page.Lending.modalDesc.isolatedDesc'),
        },
      ],
      bottomSheetModalProps: {
        enableContentPanningGesture: true,
        enablePanDownToClose: true,
        enableDismissOnClose: true,
        snapPoints: [308],
      },
      nextButtonProps: {
        title: t('page.Lending.gotIt'),
        onPress: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        containerStyle: {
          position: 'absolute',
          bottom: 48,
          width: '100%',
        },
      },
    });
  };

  return (
    <Pressable
      style={styles.container}
      onPress={disablePress ? undefined : handleShow}>
      <Text style={styles.text}>{t('page.Lending.isolated')}</Text>
      <RcInfoFillCC
        width={14}
        height={14}
        color={colors2024['orange-default']}
      />
    </Pressable>
  );
};

export default IsolatedTag;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    borderWidth: 0.8,
    borderColor: colors2024['orange-light-2'],
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
    backgroundColor: colors2024['orange-light-1'],
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['orange-default'],
  },
}));
