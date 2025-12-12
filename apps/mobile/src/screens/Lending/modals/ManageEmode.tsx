import React, { useCallback } from 'react';

import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { Button } from '@/components2024/Button';
import { createGetStyles2024 } from '@/utils/styles';
import AutoLockView from '@/components/AutoLockView';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';

export const ManageEmodeModal = ({ onClose }: { onClose: () => void }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const handlePressManageEMode = useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.MANAGE_EMODE_FULL,
      allowAndroidHarewareBack: true,
      bottomSheetModalProps: {
        rootViewType: 'View',
        enableContentPanningGesture: true,
      },
      onClose: () => {
        removeGlobalBottomSheetModal2024(id);
      },
    });
    onClose?.();
  }, [onClose]);

  return (
    <AutoLockView as="View" style={styles.container}>
      <Text style={styles.title}>
        {t('page.Lending.manageEmode.guide.title')}
      </Text>
      <Text style={styles.description}>
        {t('page.Lending.manageEmode.guide.description')}
      </Text>
      <Button
        containerStyle={styles.button}
        title={t('page.Lending.manageEmode.guide.buttonTitle')}
        onPress={handlePressManageEMode}
      />
    </AutoLockView>
  );
};
const getStyles = createGetStyles2024(ctx => ({
  container: {
    paddingHorizontal: 25,
    height: '100%',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  title: {
    color: ctx.colors2024['neutral-title-1'],
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
    fontFamily: 'SF Pro Rounded',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    marginTop: 8,
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  button: {
    position: 'absolute',
    bottom: 56,
    width: '100%',
  },
  disabledButton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
  disabledTitle: {
    color: ctx.colors2024['neutral-title-1'],
  },
}));
