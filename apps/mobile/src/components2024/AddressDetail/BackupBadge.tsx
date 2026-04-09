import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Text } from '@/components/Typography';
import WarningIcon from '@/assets2024/icons/common/warning-circle-cc.svg';
import { useTranslation } from 'react-i18next';

interface BackupBadgeProps {
  onPress?: () => void;
}

export const BackupBadge: React.FC<BackupBadgeProps> = ({ onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const content = (
    <View style={styles.container}>
      <WarningIcon
        width={18}
        height={18}
        color={colors2024['orange-default']}
      />
      <Text style={styles.text}>{t('backupReminder.badge')}</Text>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
  }

  return content;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors2024['orange-light-1'],
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
    color: colors2024['orange-default'],
  },
}));
