import React, { useState } from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import { default as SvgIconArrowDownTriangle } from '@/assets/icons/gas-top-up/arrow-down-cc.svg';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { CHAINS_BY_NET, CHAINS_ENUM } from '@/constant/chains';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import {
  SelectSortedChainModal,
  SelectSortedChainProps,
} from '@/components/SelectSortedChain';
import { Text } from '@/components';

const allMainnetChainEnums = CHAINS_BY_NET.mainnet.map(item => item.enum);

const getStyles = createGetStyles(colors => ({
  container: {
    backgroundColor: colors['neutral-card-2'],
    borderRadius: 4,
    padding: 16,
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
    width: 32,
    height: 32,
    borderRadius: 9999,
    marginRight: 12,
  },
  text: {
    fontWeight: '500',
    fontSize: 20,
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

export const ChainSelect = ({
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
            width={20}
            height={20}
            color={colors['neutral-foot']}
          />
        )}
      </TouchableOpacity>
      {!readonly && (
        <SelectSortedChainModal
          visible={showSelectorModal}
          value={value}
          onCancel={handleCancel}
          supportChains={allMainnetChainEnums}
          disabledTips={getDisabledTips}
          onChange={handleChange}
        />
      )}
    </>
  );
};
