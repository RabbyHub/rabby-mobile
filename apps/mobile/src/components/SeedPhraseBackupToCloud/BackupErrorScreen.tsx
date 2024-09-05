import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '../ScreenContainer/FooterButtonScreenContainer';
import { BackupIcon } from './BackupIcon';

const getStyles = createGetStyles(colors => ({
  root: {
    height: 328,
    paddingTop: 52,
    backgroundColor: colors['neutral-bg-1'],
  },
}));

interface Props {
  onConfirm: () => void;
}

export const BackupErrorScreen: React.FC<Props> = ({ onConfirm }) => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  return (
    <FooterButtonScreenContainer
      buttonText={'重试'}
      onPressButton={onConfirm}
      style={styles.root}>
      <BackupIcon status="error" isGray description={'备份失败'} />
    </FooterButtonScreenContainer>
  );
};
