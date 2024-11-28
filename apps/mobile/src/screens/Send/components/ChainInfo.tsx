import {
  StyleProp,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import { CHAINS_ENUM } from '@/constant/chains';
import { RcArrowDownCC } from '@/assets/icons/common';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { SelectSortedChainProps } from '@/components/SelectSortedChain';
import { useFindChain } from '@/hooks/useFindChain';
import React from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import {
  MODAL_ID,
  MODAL_NAMES,
} from '@/components2024/GlobalBottomSheetModal/types';

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

  const modalRef = React.useRef<MODAL_ID>();

  const removeChainModal = React.useCallback(() => {
    if (modalRef.current) {
      removeGlobalBottomSheetModal2024(modalRef.current);
    }
  }, []);

  const createChainModal = React.useCallback(() => {
    modalRef.current = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.SELECT_SORTED_CHAIN,
      value: chainEnum,
      onClose: removeChainModal,
      supportChains,
      disabledTips,
      hideMainnetTab,
      hideTestnetTab,
      onChange: chain => {
        removeChainModal();
        onChange?.(chain);
      },
    });
  }, [
    chainEnum,
    disabledTips,
    hideMainnetTab,
    hideTestnetTab,
    onChange,
    removeChainModal,
    supportChains,
  ]);

  return (
    <>
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={createChainModal}>
        <View style={styles.left}>
          <ChainIconImage
            size={24}
            chainEnum={chainEnum}
            isShowRPCStatus={true}
          />
          <Text style={[styles.chainName, titleStyle]}>{chainItem?.name}</Text>
        </View>

        <View>{rightArrowIcon ? rightArrowIcon : <RcArrowDown />}</View>
      </TouchableOpacity>
    </>
  );
}
