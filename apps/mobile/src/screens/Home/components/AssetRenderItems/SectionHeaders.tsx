import {
  View,
  Text,
  Pressable,
  ViewStyle,
  StyleProp,
  StyleSheet,
} from 'react-native';
import React, { memo } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { useFindChain } from '@/hooks/useFindChain';
import ChainFilterItem from '@/components/Token/ChainFilterItem';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByServerID } from '@/utils/chain';

export type AsssetKey = 'token' | 'defi' | 'nft';

export const ChainSelector = ({
  top3Chains,
  onChainClick,
  chainServerId,
  style,
}: {
  chainServerId?: string;
  top3Chains?: string[];
  onChainClick?: (clear: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) => {
  const chainInfo = useFindChain({
    serverId: chainServerId || null,
  });
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return chainInfo?.id ? (
    <View style={StyleSheet.flatten([styles.chainContainer, style])}>
      <ChainFilterItem
        style={styles.chainFilterItem}
        chainItem={chainInfo}
        onPress={() => onChainClick?.(false)}
        onRemoveFilter={() => onChainClick?.(true)}
      />
    </View>
  ) : (
    !!top3Chains?.length && (
      <Pressable
        style={StyleSheet.flatten([styles.chainContainer, style])}
        onPress={() => onChainClick?.(false)}>
        <View style={styles.chainIconsContainer}>
          {top3Chains.map((chainId, index) => (
            <View
              key={chainId}
              style={StyleSheet.flatten([
                styles.chainIconContainer,
                { marginLeft: index === 0 ? 0 : -8 },
              ])}>
              <ChainIconImage
                containerStyle={styles.chainIcon}
                size={18}
                chainEnum={findChainByServerID(chainId)?.enum}
                key={index}
              />
            </View>
          ))}
        </View>
        <Text style={styles.countChain}>All</Text>
        <ArrowRightSVG
          style={styles.icon}
          width={16}
          color={colors2024['neutral-secondary']}
        />
      </Pressable>
    )
  );
};

const getStyle = createGetStyles2024(ctx => ({
  countChain: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-foot'],
    marginLeft: 2,
  },
  icon: {
    transform: [{ rotate: '90deg' }],
    marginLeft: 4,
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    height: 32,
    overflow: 'hidden',
  },
  chainFilterItem: {
    backgroundColor: 'transparent',
    gap: 0,
    paddingHorizontal: 0,
  },
  chainIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chainIconContainer: {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 20,
  },
  chainIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
