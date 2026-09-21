import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Dimensions, View } from 'react-native';
import { TopSearch } from '../TopSearch';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';

interface IProps {
  isSearching?: boolean;
  textTitle?: string;
  type: 'contract' | 'assets' | 'EIP7702';
  inputValue: string;
  inputOnChange: (s: string) => void;
  currentAccount?: KeyringAccountWithAlias | null;
}
export const HeaderCenter = (props: IProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[props.isSearching && styles.container]}>
      {props.isSearching ? (
        <TopSearch value={props.inputValue} onChange={props.inputOnChange} />
      ) : (
        <View style={styles.title}>
          <WalletIcon
            type={props.currentAccount?.brandName as KEYRING_TYPE}
            address={props.currentAccount?.address}
            style={styles.walletIcon}
            width={25}
            height={25}
            borderRadius={6}
          />
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.titleText}>
            {props.currentAccount?.aliasName ||
              ellipsisAddress(props.currentAccount?.address || '')}
          </Text>
        </View>
      )}
    </View>
  );
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginLeft: 8,
    width: '100%',
  },
  title: {
    gap: 8,
    flexDirection: 'row',
    maxWidth: SCREEN_WIDTH - 100,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    flexShrink: 1,
  },
  walletIcon: {
    width: 25,
    height: 25,
    flexShrink: 0,
  },
}));
