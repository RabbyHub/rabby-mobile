import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';

export const DappSearchEmpty = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      <RcIconEmpty />
      <Text style={styles.emptyText}>No Results Found</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    paddingTop: 140,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 21,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));
