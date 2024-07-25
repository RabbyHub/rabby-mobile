import { useState, useMemo } from 'react';
import { Text, View } from 'react-native';

import { CHAINS_ENUM } from '@/constant/chains';

import { RcArrowDownCC } from '@/assets/icons/common';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import TouchableView from '@/components/Touchable/TouchableView';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { findChainByEnum } from '@/utils/chain';
import SelectSortedChainModal from '@/components/SelectSortedChain/SheetModal';
import { SelectSortedChainProps } from '@/components/SelectSortedChain';
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
  onChange,
  supportChains,
  disabledTips,
  hideMainnetTab,
  hideTestnetTab,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
    supportChains?: SelectSortedChainProps['supportChains'];
    disabledTips?: SelectSortedChainProps['disabledTips'];
    hideMainnetTab?: SelectSortedChainProps['hideMainnetTab'];
    hideTestnetTab?: SelectSortedChainProps['hideTestnetTab'];
  }
>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const [showSelectorModal, setShowSelectorModal] = useState(false);
  // const chainItem = useMemo(() => {
  //   return findChainByEnum(chainEnum, { fallback: true })!;
  // }, [chainEnum]);

  const chainItem = useFindChain({
    enum: chainEnum,
  });

  return (
    <>
      <TouchableView
        style={[styles.container, style]}
        onPress={() => {
          setShowSelectorModal(true);
        }}>
        <View style={styles.left}>
          <ChainIconImage size={24} chainEnum={chainEnum} />
          <Text style={styles.chainName}>{chainItem?.name}</Text>
        </View>

        <View>
          <RcArrowDown />
        </View>
      </TouchableView>

      <SelectSortedChainModal
        visible={showSelectorModal}
        value={chainEnum}
        onCancel={() => {
          setShowSelectorModal(false);
        }}
        supportChains={supportChains}
        disabledTips={disabledTips}
        hideMainnetTab={hideMainnetTab}
        hideTestnetTab={hideTestnetTab}
        onChange={chain => {
          setShowSelectorModal(false);
          onChange?.(chain);
        }}
      />
    </>
  );
}
