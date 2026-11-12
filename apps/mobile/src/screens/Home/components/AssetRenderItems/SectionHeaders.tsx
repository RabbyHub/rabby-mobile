import {
  View,
  Pressable,
  ViewStyle,
  StyleProp,
  StyleSheet,
} from 'react-native';
import React from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { useFindChain } from '@/hooks/useFindChain';
import ChainFilterItem from '@/components/Token/ChainFilterItem';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { findChainByServerID } from '@/utils/chain';
import { Text } from '@/components/Typography';
import { CustomSkeleton } from '@/components2024/CustomSkeleton';

/**
 * Width reserved by the Home tab row for the chain filter. The selector itself
 * stays content-sized so it also works in the Send token sheet, but Home keeps
 * this slot fixed so the tab labels do not reflow while the projection loads.
 * 96pt covers three 20pt icon slots (the two trailing slots overlap by 8pt),
 * the horizontal padding, the "All" label and the 16pt arrow.
 */
export const CHAIN_SELECTOR_SLOT_WIDTH = 96;
export const ChainSelector = ({
  top3Chains,
  onChainClick,
  chainServerId,
  style,
  loading = false,
}: {
  chainServerId?: string;
  top3Chains?: string[];
  onChainClick?: (clear: boolean) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * The chain projection is still being built. Render skeleton icons instead of
   * an empty pill so a cold start shows a loading state rather than a control
   * that looks broken until the logos arrive (QA 1157).
   */
  loading?: boolean;
}) => {
  const chainInfo = useFindChain({
    serverId: chainServerId || null,
  });
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const isLoading = loading;
  const visibleChains = (top3Chains ?? []).slice(0, 3);

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
    // Render the filter immediately and fill the top chains in when the asset
    // projection is ready. Waiting for the projection left the control blank
    // for seconds after the token list started loading (QA 1145).
    <Pressable
      style={StyleSheet.flatten([styles.chainContainer, style])}
      onPress={() => onChainClick?.(false)}>
      <View style={styles.chainIconsContainer}>
        {visibleChains.map((chainId, index) => (
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
            />
          </View>
        ))}
        {isLoading && !visibleChains.length ? (
          <View style={styles.chainIconContainer}>
            <CustomSkeleton
              circle
              width={18}
              height={18}
              style={styles.chainIconSkeleton}
            />
          </View>
        ) : null}
      </View>
      <Text style={styles.countChain}>All</Text>
      <ArrowRightSVG
        style={styles.icon}
        width={16}
        color={colors2024['neutral-secondary']}
      />
    </Pressable>
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
  chainIconSkeleton: {
    backgroundColor: ctx.colors2024['neutral-line'],
  },
}));
