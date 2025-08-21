import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { RcLogoutCC } from '@/assets2024/icons/perps';

export const PerpsHeaderRight = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <TouchableOpacity>
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
