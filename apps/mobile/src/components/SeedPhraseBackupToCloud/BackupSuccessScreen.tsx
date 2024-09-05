import { IS_IOS } from '@/core/native/utils';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { BackupIcon } from './BackupIcon';

const getStyles = createGetStyles(colors => ({
  root: {
    alignItems: 'center',
    height: 320,
    paddingTop: 52,
  },
}));

interface Props {}

export const BackupSuccessScreen: React.FC<Props> = () => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const description = IS_IOS ? '已备份到 iCloud' : '已备份到 Google Drive';

  return (
    <View style={styles.root}>
      <BackupIcon status="success" isGray description={description} />
    </View>
  );
};
