import { useState, useMemo } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';

import { CHAINS_ENUM } from '@/constant/chains';

import { RcArrowDownCC } from '@/assets/icons/common';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { SelectSortedChainProps } from '@/components2024/SelectChainWithSummary';
import { useFindChain } from '@/hooks/useFindChain';

const RcArrowDown = makeThemeIconFromCC(RcArrowDownCC, 'neutral-foot');

const getStyles = createGetStyles(colors => {
  return {
    container: {
      borderRadius: 4,
      padding: 12,
      backgroundColor: colors['neutral-card2'],

      width: '100%',
      height: 52,

      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },

    left: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    chainName: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: '600',

      marginLeft: 8,
    },
  };
});

export function ChainInfo({
  chainEnum,
  style,
  rightArrowIcon,
  titleStyle,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
    supportChains?: SelectSortedChainProps['supportChains'];
    disabledTips?: SelectSortedChainProps['disabledTips'];
    hideMainnetTab?: SelectSortedChainProps['hideMainnetTab'];
    hideTestnetTab?: SelectSortedChainProps['hideTestnetTab'];
    rightArrowIcon?: React.ReactNode;
    titleStyle?: StyleProp<TextStyle>;
  }
>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const chainItem = useFindChain({
    enum: chainEnum,
  });

  return (
    <>
      <View style={[styles.container, style]}>
        <View style={styles.left}>
          <ChainIconImage size={24} chainEnum={chainEnum} />
          <Text style={[styles.chainName, titleStyle]}>{chainItem?.name}</Text>
        </View>

        {/* <View>{rightArrowIcon ? rightArrowIcon : <RcArrowDown />}</View> */}
      </View>
    </>
  );
}
