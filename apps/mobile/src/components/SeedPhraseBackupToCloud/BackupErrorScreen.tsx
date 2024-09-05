import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '../ScreenContainer/FooterButtonScreenContainer';
import { BackupIcon } from './BackupIcon';

const getStyles = createGetStyles(colors => ({
  root: {
    alignItems: 'center',
    height: 328,
    paddingTop: 52,
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
      btnProps={{
        footerStyle: {
          paddingBottom: 50,
        },
      }}
      style={styles.root}>
      <BackupIcon status="error" isGray description={'备份失败'} />
    </FooterButtonScreenContainer>
  );
};
