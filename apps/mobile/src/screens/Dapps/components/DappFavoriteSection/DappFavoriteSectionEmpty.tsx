import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-favorite-empty-dark.svg';
import { IS_IOS } from '@/core/native/utils';

export const DappFavoriteSectionEmpty = () => {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      {isLight ? (
        <RcIconEmpty style={styles.emptyIcon} />
      ) : (
        <RcIconEmptyDark style={styles.emptyIcon} />
      )}
      <Text style={styles.emptyText}>
        {IS_IOS ? 'No website added yet' : 'No Dapps added yet'}
      </Text>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  empty: {
    borderRadius: 20,
    backgroundColor: colors2024['neutral-bg-1'],
    borderStyle: 'solid',
    borderColor: colors2024['neutral-line'],
    borderWidth: 1,
    paddingVertical: 20,

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
}));
