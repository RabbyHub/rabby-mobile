import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';

export const DappFavoriteSectionEmpty = () => {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      <RcIconEmpty />
      <Text style={styles.emptyText}>No Dapps added yet</Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-bg-3'],
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
    paddingVertical: 25,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));
