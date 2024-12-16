import React from 'react';
import { View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  shadowView: {
    shadowColor: colors2024['neutral-black'],
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 8,
  },
}));

interface Props {
  children: React.ReactNode;
}

export const AddressItemShadowView = (props: Props) => {
  const { styles } = useTheme2024({ getStyle });

  return <View style={styles.shadowView}>{props.children}</View>;
};
