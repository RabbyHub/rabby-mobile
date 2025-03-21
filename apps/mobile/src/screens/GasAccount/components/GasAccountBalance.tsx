import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useGasAccountInfoV2 } from '../hooks';
import { formatUsdValue } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';
import { GasAccountInfo } from '@rabby-wallet/rabby-api/dist/types';

export interface GasAccountBalanceProps {
  style?: StyleProp<TextStyle>;
  account?: GasAccountInfo;
}

export const GasAccountBalance: React.FC<GasAccountBalanceProps> = ({
  style,
  account,
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });

  if (!account || account.no_register) {
    return null;
  }

  return (
    <Text style={[styles.text, style]}>
      {account?.balance ? formatUsdValue(account?.balance) : '$0'}
    </Text>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    text: {
      fontFamily: 'SF Pro Rounded',
      text: 17,
      lineHeight: 22,
      fontWeight: '700',
      color: colors2024['neutral-body'],
    },
  };
});
