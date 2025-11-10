import { Pressable, TouchableOpacity, View, Text } from 'react-native';
import { Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import ChainIconImage from '../Chain/ChainIconImage';
import CloseBoldSVG from '@/assets2024/icons/common/close-bold-cc.svg';
import { AddressItem } from '@/components2024/AddressItem/AddressItem';
import { Account } from '@/core/services/preference';

const FILTER_ITEM_H = 34;

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    chainFilterItem: {
      height: FILTER_ITEM_H,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-5'],
      paddingHorizontal: 8,
      gap: 6,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    chainFilterChainName: {
      color: colors2024['neutral-foot'],
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginHorizontal: 4,
    },

    chainFilterItemClose: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});

export default function ChainFilterItem({
  style,
  chainItem,
  onPress,
  onRemoveFilter,
  hideChainText,
}: RNViewProps & {
  chainItem?: Chain | null;
  onPress?: () => void;
  onRemoveFilter?: (item: Chain | null) => void;
  hideChainText?: boolean;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (!chainItem) return null;

  return (
    <View style={[styles.chainFilterItem, style]}>
      <Pressable
        hitSlop={10}
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ChainIconImage size={16} chainEnum={chainItem.enum} />
        {!hideChainText && (
          <Text style={[styles.chainFilterChainName]}>{chainItem.name}</Text>
        )}
      </Pressable>
      <TouchableOpacity
        hitSlop={10}
        style={styles.chainFilterItemClose}
        onPress={() => {
          // TODO: remove filter
          onRemoveFilter?.(chainItem);
        }}>
        <CloseBoldSVG color={colors2024['neutral-foot']} />
      </TouchableOpacity>
    </View>
  );
}

export function AccountFilterItem({
  filterAccount,
  onRemoveFilter,
}: {
  filterAccount?: Account | null;
  onRemoveFilter?: (account?: Account | null) => void;
}) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getAccountFilterItemStyle,
  });

  if (!filterAccount) return null;

  return (
    <AddressItem account={filterAccount}>
      {({ WalletIcon }) => {
        return (
          <View style={styles.filterAccountButton}>
            <WalletIcon style={styles.filterAccountWalletIcon} />
            {/* <Text style={styles.filterAccountAddress}>{aliasName}</Text> */}
            <TouchableOpacity
              hitSlop={10}
              style={styles.filterAccountClose}
              onPress={() => {
                // TODO: remove filter
                onRemoveFilter?.(filterAccount);
              }}>
              <CloseBoldSVG color={colors2024['neutral-foot']} />
            </TouchableOpacity>
          </View>
        );
      }}
    </AddressItem>
  );
}

const getAccountFilterItemStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    filterAccountButton: {
      height: FILTER_ITEM_H,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-5'],
      paddingHorizontal: 8,
      gap: 6,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    filterAccountWalletIcon: {
      width: 18,
      height: 18,
      borderRadius: 4,
    },
    filterAccountAddress: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginHorizontal: 6,
    },

    filterAccountClose: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  };
});
