import { Text, View } from 'react-native';
import { Chain } from '@/constant/chains';

import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import ChainIconImage from '../Chain/ChainIconImage';
import TouchableView from '../Touchable/TouchableView';

import ChainFilterCloseCC from './icons/chain-filter-close-cc.svg';

const getStyles = createGetStyles(colors => {
  return {
    chainFilterItem: {
      height: 33,
      borderRadius: 4,
      backgroundColor: colors['neutral-card2'],
      paddingLeft: 8,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    chainFilterChainName: {
      color: colors['neutral-body'],
      fontSize: 14,
      fontWeight: '500',

      marginHorizontal: 6,
    },

    chainFilterItemClose: {
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 8,
      // // leave here for debug
      // borderColor: 'blue',
      // borderWidth: 1,
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
  const colors = useThemeColors();
  const styles = getStyles(colors);

  if (!chainItem) return null;

  return (
    <View style={[styles.chainFilterItem, style]}>
      <ChainIconImage size={16} chainEnum={chainItem.enum} />
      <Text style={[styles.chainFilterChainName]}>{chainItem.name}</Text>
      <TouchableView
        style={styles.chainFilterItemClose}
        onPress={() => {
          // TODO: remove filter
          onRmove?.(chainItem);
        }}>
        <ChainFilterCloseCC color={colors['neutral-foot']} />
      </TouchableView>
    </View>
  );
}
