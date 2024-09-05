import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BackupIcon } from '../SeedPhraseBackupToCloud/BackupIcon';

const getStyles = createGetStyles(colors => ({
  root: {
    alignItems: 'center',
    height: 320,
    paddingTop: 52,
  },
}));

interface Props {}

export const BackupRestoreScreen: React.FC<Props> = () => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const description = t(
    'page.newAddress.seedPhrase.backupRestoreDownloadTitle',
  );

  return (
    <View style={styles.root}>
      <BackupIcon status="downloading" isGray description={description} />
    </View>
  );
};
