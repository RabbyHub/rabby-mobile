import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FooterButtonScreenContainer } from '@/components2024/ScreenContainer/FooterButtonScreenContainer';
import { BackupIcon } from '@/components/SeedPhraseBackupToCloud2024/BackupIcon';

const getStyles = createGetStyles(colors => ({
  root: {
    // height: 328,
    paddingTop: 52,
    height: '100%',
    backgroundColor: colors['neutral-bg-1'],
  },
}));

interface Props {
  onConfirm: () => void;
  errorMessage?: string;
}

export const BackupErrorScreen: React.FC<Props> = ({
  onConfirm,
  errorMessage,
}) => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  return (
    <FooterButtonScreenContainer
      as="View"
      buttonProps={{
        title: t('page.newAddress.seedPhrase.backupFailedButton'),
        onPress: onConfirm,
      }}
      style={styles.root}
      footerBottomOffset={56}
      footerContainerStyle={{
        paddingHorizontal: 20,
      }}>
      <BackupIcon
        status="error"
        isGray
        isDown={true}
        description={
          errorMessage || t('page.newAddress.seedPhrase.backupFailedTitle')
        }
      />
    </FooterButtonScreenContainer>
  );
};
