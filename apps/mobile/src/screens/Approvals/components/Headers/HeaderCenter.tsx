import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Dimensions, View } from 'react-native';
import { TopSearch } from '../TopSearch';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { Text } from '@/components/Typography';
import { ellipsisAddress } from '@/utils/address';
import { HeaderBackPressable } from '@/hooks/navigation';

interface IProps {
  isSearching?: boolean;
  textTitle?: string;
  type: 'contract' | 'assets' | 'EIP7702';
  inputValue: string;
  inputOnChange: (s: string) => void;
  currentAccount?: KeyringAccountWithAlias | null;
}
export const HeaderCenter = (props: IProps) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  return (
    <View pointerEvents="box-none" style={styles.header}>
      {/* The row draws its own back button (same pattern as the token detail
          header) so the search field can start right after it on every device
          instead of inheriting the native iOS 26 back-item inset. QA 1328. */}
      <HeaderBackPressable
        style={styles.inlineBack}
        tintColor={colors2024['neutral-title-1']}
      />
      {props.isSearching ? (
        <View style={styles.searchArea}>
          <TopSearch value={props.inputValue} onChange={props.inputOnChange} />
        </View>
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
// Same row width as the token detail header: the space left after the bar
// inset/back slot, so `[back][8][content]` starts right after the chevron.
const HEADER_CONTENT_WIDTH = SCREEN_WIDTH - 65;
const BACK_BUTTON_SLOT = 24 + 8;

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  header: {
    width: HEADER_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inlineBack: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  searchArea: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    flex: 1,
    marginLeft: 8,
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
