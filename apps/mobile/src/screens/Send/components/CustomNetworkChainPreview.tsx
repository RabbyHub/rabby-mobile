import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { findChainByServerID } from '@/utils/chain';

export function CustomNetworkChainPreview({
  top3Chains,
  style,
}: {
  top3Chains?: string[];
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useTheme2024({ getStyle });

  if (!top3Chains?.length) {
    return null;
  }

  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
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
            />
          </View>
        ))}
      </View>
      <Text style={styles.countChain}>All</Text>
    </View>
  );
}

const getStyle = createGetStyles2024(ctx => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ctx.colors2024['brand-light-1'],
    borderColor: ctx.colors2024['brand-disable'],
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    height: 32,
    overflow: 'hidden',
    opacity: 0.5,
  },
  chainIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chainIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 20,
  },
  chainIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChain: {
    color: ctx.colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    marginLeft: 2,
  },
}));
