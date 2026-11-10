import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Dimensions, View } from 'react-native';
import { TopSearch } from '../TopSearch';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';
import { IS_ANDROID, IS_IOS } from '@/core/native/utils';

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
    <View
      pointerEvents="box-none"
      style={[styles.header, props.isSearching && styles.headerSearching]}>
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
const HEADER_CONTENT_WIDTH = SCREEN_WIDTH - 100;
// The native title container is not centred on the screen: iOS lays it out
// after the leading back item (+65pt including the bar inset), Android ends it
// short of the trailing action (-20pt). Reserve the missing space on the
// opposite edge so the inner centring box is symmetric about the screen centre.
const HEADER_SIDE_RESERVE = IS_IOS
  ? { paddingRight: 65 }
  : IS_ANDROID
  ? { paddingLeft: 20 }
  : {};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    width: HEADER_CONTENT_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    ...HEADER_SIDE_RESERVE,
  },
  headerSearching: {
    flexDirection: 'row',
  },
  title: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontWeight: '900',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
    textAlign: 'center',
    flexShrink: 1,
  },
  walletIcon: {
    width: 25,
    height: 25,
    flexShrink: 0,
  },
}));
