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
type Props = {
  onPress: (key: AsssetKey) => void;
  currentSection: AsssetKey;
  chainServerId?: string;
  chainLength?: number;
  onChainClick?: (clear: boolean) => void;
  disableNft?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const AssestAllHeader = memo(
  ({
    onPress,
    style,
    currentSection,
    chainLength,
    onChainClick,
    chainServerId,
    disableNft,
  }: Props) => {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const chainInfo = useFindChain({
      serverId: chainServerId || null,
    });
    const handlePress = (key: AsssetKey) => {
      onPress?.(key);
    };

    return (
      <View style={[styles.container, style]}>
        <View style={styles.leftContainer}>
          <Pressable onPress={() => handlePress('token')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'token' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Token')}
            </Text>
          </Pressable>
          <Pressable onPress={() => handlePress('defi')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'defi' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Defi')}
            </Text>
          </Pressable>

          {!disableNft && (
            <Pressable onPress={() => handlePress('nft')}>
              <Text
                style={[
                  styles.symbol,
                  currentSection === 'nft' && styles.active,
                ]}>
                {t('page.singleHome.sectionHeader.Nft')}
              </Text>
            </Pressable>
          )}
        </View>
        {!!chainLength &&
          (chainInfo?.id ? (
            <View style={styles.chainContainer}>
              <ChainFilterItem
                style={styles.chainFilterItem}
                chainItem={chainInfo}
                onPress={() => onChainClick?.(false)}
                onRemoveFilter={() => onChainClick?.(true)}
              />
            </View>
          ) : (
            <Pressable
              style={styles.chainContainer}
              onPress={() => onChainClick?.(false)}>
              <Text style={styles.countChain}>
                {t('page.singleHome.sectionHeader.totalChain', {
                  count: chainLength || 0,
                })}
              </Text>
              <ArrowRightSVG
                style={styles.icon}
                width={16}
                color={colors2024['neutral-body']}
              />
            </Pressable>
          ))}
      </View>
    );
  },
);

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
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: ASSETS_SECTION_HEADER,
  },
  leftContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
  },
  countChain: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-foot'],
    marginLeft: 2,
  },
  active: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-title-1'],
  },
  emptyHolder: {
    marginTop: 65,
  },
  emptyImg: {
    width: 160,
    height: 117,
  },
  emptyText: {
    marginTop: 21,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
  },
  tooltipText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
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
