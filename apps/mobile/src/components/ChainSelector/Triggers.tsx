import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { CHAINS_ENUM } from '@debank/common';

import { RcArrowDownCC } from '@/assets/icons/common';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import TouchableView from '@/components/Touchable/TouchableView';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { findChainByEnum } from '@/utils/chain';
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '../GlobalBottomSheetModal/utils';
import { MODAL_NAMES } from '../GlobalBottomSheetModal/types';

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
    },
    chainName: {
      color: colors['neutral-title1'],
      fontSize: 16,
      fontWeight: 'bold',
    },
  };
});

export function ChainSelectorTrigger({
  chainEnum,
  style,
  onChange,
}: React.PropsWithChildren<
  RNViewProps & {
    chainEnum?: CHAINS_ENUM;
    onChange?: (chain: CHAINS_ENUM) => void;
  }
>) {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  const chainItem = useMemo(() => {
    return findChainByEnum(chainEnum) || findChainByEnum(CHAINS_ENUM.ETH)!;
  }, [chainEnum]);

  const handleOpenSwitchChain = useCallback(
    (value?: CHAINS_ENUM | null) => {
      const id = createGlobalBottomSheetModal({
        name: MODAL_NAMES.SELECT_CHAIN,
        value: value,
        onChange: (v: CHAINS_ENUM) => {
          onChange?.(v);
          removeGlobalBottomSheetModal(id);
        },
      });
    },
    [onChange],
  );

  return (
    <TouchableView
      style={[styles.container, style]}
      onPress={() => {
        handleOpenSwitchChain(chainEnum);
      }}>
      <View style={styles.left}>
        <ChainIconImage size={24} chainEnum={chainEnum} />
        <Text className="ml-[8]" style={styles.chainName}>
          {chainItem.name}
        </Text>
      </View>

      <View>
        <RcArrowDown />
      </View>
    </TouchableView>
  );
}
