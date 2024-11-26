import { Text, TouchableOpacity, View } from 'react-native';
import { Chain } from '@/constant/chains';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import ChainIconImage from '../Chain/ChainIconImage';
import CloseBoldSVG from '@/assets2024/icons/common/close-bold-cc.svg';

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    chainFilterItem: {
      height: 34,
      borderRadius: 12,
      backgroundColor: colors2024['neutral-bg-4'],
      paddingHorizontal: 8,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    chainFilterChainName: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
      marginHorizontal: 6,
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
  onRmove,
}: RNViewProps & {
  chainItem?: Chain | null;
  onRmove?: (item: Chain | null) => void;
}) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  if (!chainItem) return null;

  return (
    <View style={[styles.chainFilterItem, style]}>
      <ChainIconImage size={16} chainEnum={chainItem.enum} />
      <Text style={[styles.chainFilterChainName]}>{chainItem.name}</Text>
      <TouchableOpacity
        hitSlop={10}
        style={styles.chainFilterItemClose}
        onPress={() => {
          // TODO: remove filter
          onRmove?.(chainItem);
        }}>
        <CloseBoldSVG color={colors2024['neutral-foot']} />
      </TouchableOpacity>
    </View>
  );
}
