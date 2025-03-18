import { View, Text, Pressable, ViewStyle } from 'react-native';
import React, { memo } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { trigger } from 'react-native-haptic-feedback';
import ArrowRightSVG from '@/assets2024/icons/common/arrow-right-cc.svg';
import { useFindChain } from '@/hooks/useFindChain';
import ChainFilterItem from '@/components/Token/ChainFilterItem';

export type AsssetKey = 'token' | 'defi' | 'nft';
type Props = {
  onPress: (key: AsssetKey) => void;
  currentSection: AsssetKey;
  chainServerId?: string;
  chainLength?: number;
  onChainClick?: (clear: boolean) => void;
  style?: ViewStyle;
};

export const AssestAllHeader = memo(
  ({
    onPress,
    style,
    currentSection,
    chainLength,
    onChainClick,
    chainServerId,
  }: Props) => {
    const { t } = useTranslation();
    const { styles, colors2024 } = useTheme2024({ getStyle });
    const chainInfo = useFindChain({
      serverId: chainServerId || null,
    });
    const handlePress = (key: AsssetKey) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      onPress?.(key);
    };

    return (
      <View style={[styles.constainer, style]}>
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

          <Pressable onPress={() => handlePress('nft')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'nft' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Nft')}
            </Text>
          </Pressable>
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

const getStyle = createGetStyles2024(ctx => ({
  constainer: {
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
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-body'],
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
  },
  chainContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chainFilterItem: {
    backgroundColor: 'transparent',
  },
}));
