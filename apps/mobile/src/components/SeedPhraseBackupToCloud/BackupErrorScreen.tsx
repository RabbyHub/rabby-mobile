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

export const BackupErrorScreen: React.FC<Props> = () => {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  return (
    <View style={styles.root}>
      <BackupIcon status="error" isGray description={'备份失败'} />
    </View>
  );
};
