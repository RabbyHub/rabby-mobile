import React, { useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { default as SvgIconArrowDownTriangle } from '@/assets/icons/gas-top-up/arrow-down-cc.svg';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM, getChainList } from '@/constant/chains';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import {
  SelectSortedChainModal,
  SelectSortedChainProps,
} from '@/components/SelectSortedChain';
import { Text } from '@/components';

const getStyles = createGetStyles(colors => ({
  container: {
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 8,
    height: 60,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  column: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },

  icon: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    marginRight: 12,
  },
  text: {
    fontWeight: '500',
    fontSize: 18,
    lineHeight: 23,
    color: colors['neutral-title-1'],
  },
}));

const getDisabledTips: SelectSortedChainProps['disabledTips'] = ctx => {
  const chainItem = findChainByServerID(ctx.chain.serverId);

  if (chainItem?.isTestnet) {
    return 'Testnet is not supported';
  }

  return 'Coming Soon';
};

interface ChainSelectProps {
  value: CHAINS_ENUM;
  onChange?(value: CHAINS_ENUM): void;
  readonly?: boolean;
  showModal?: boolean;
  direction?: 'top' | 'bottom';
}

export const GasTopUpChainSelect = ({
  value,
  onChange,
  readonly = false,
  showModal = false,
}: ChainSelectProps) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [showSelectorModal, setShowSelectorModal] = useState(showModal);

  const handleClickSelector = () => {
    if (readonly) {
      return;
    }
    setShowSelectorModal(true);
  };

  const handleCancel = () => {
    if (readonly) {
      return;
    }
    setShowSelectorModal(false);
  };

  const handleChange = React.useCallback(
    (v: CHAINS_ENUM) => {
      if (readonly) {
        return;
      }
      onChange && onChange(v);
      setShowSelectorModal(false);
    },
    [readonly, onChange],
  );

  const chainItem = React.useMemo(() => findChainByEnum(value), [value]);

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handleClickSelector}>
        <View style={styles.column}>
          <Image source={{ uri: chainItem?.logo }} style={styles.icon} />
          <Text style={styles.text}>{chainItem?.name}</Text>
        </View>
        {!readonly && (
          <SvgIconArrowDownTriangle
            width={24}
            height={24}
            color={colors['neutral-foot']}
          />
        )}
      </TouchableOpacity>
      {!readonly && (
        <SelectSortedChainModal
          visible={showSelectorModal}
          value={value}
          onCancel={handleCancel}
          supportChains={getChainList('mainnet').map(item => item.enum)}
          disabledTips={getDisabledTips}
          onChange={handleChange}
        />
      )}
    </>
  );
};
