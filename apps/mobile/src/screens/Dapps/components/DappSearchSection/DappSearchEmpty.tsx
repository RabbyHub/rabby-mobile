import RcIconEmpty from '@/assets/icons/dapp/dapp-history-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-history-empty-dark.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface Props {
  onLinkPress?(): void;
}

export const DappSearchEmpty: React.FC<Props> = ({ onLinkPress }) => {
  const { styles, isLight } = useTheme2024({ getStyle });

  return (
    <View style={styles.empty}>
      {isLight ? <RcIconEmpty /> : <RcIconEmptyDark />}
      <View style={styles.emptyContent}>
        <Text style={styles.emptyText}>No Results Found</Text>
        <TouchableOpacity onPress={onLinkPress}>
          <Text style={styles.emptyLink}>Try Enter a url directly</Text>
        </TouchableOpacity>
      </View>
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
  emptyContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
    textAlign: 'center',
  },
  emptyLink: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['brand-default'],
    fontWeight: '700',
    textAlign: 'center',
  },
}));
