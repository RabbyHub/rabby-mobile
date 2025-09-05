import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { RcLogoutCC } from '@/assets2024/icons/perps';

export const PerpsHeaderRight: React.FC<{
  isLogin?: boolean;
  onPress?(): void;
}> = ({ isLogin, onPress }) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (!isLogin) {
    return null;
  }
  return (
    <TouchableOpacity onPress={onPress}>
      <RcLogoutCC style={styles.icon} color={colors2024['neutral-body']} />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  icon: {
    width: 20,
    height: 20,
  },
}));
