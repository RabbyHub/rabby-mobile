import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useGasAccountInfoV2 } from '../hooks';
import { formatUsdValue } from '@rabby-wallet/biz-utils/dist/isomorphic/biz-number';

export interface GasAccountBalanceProps {
  style?: StyleProp<TextStyle>;
  address: string;
}

export const GasAccountBalance: React.FC<GasAccountBalanceProps> = ({
  style,
  address,
}) => {
  const { styles } = useTheme2024({
    getStyle,
  });
  const { data } = useGasAccountInfoV2({ address });
  if (data?.account.no_register) {
    return null;
  }
  return (
    <Text style={[styles.text, style]}>
      {data?.account.balance ? formatUsdValue(data.account.balance) : '$0'}
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
      color: colors2024['neutral-title-1'],
    },
  };
});
