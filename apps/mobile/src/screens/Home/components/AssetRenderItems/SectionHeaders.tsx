import { View, Text, Pressable, ViewStyle } from 'react-native';
import React, { memo, useState } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { trigger } from 'react-native-haptic-feedback';
import { Tooltip } from '@rneui/themed';

export type AsssetKey = 'token' | 'defi' | 'nft';
type Props = {
  onPress: (key: AsssetKey) => void;
  hasToken?: boolean;
  hasDefi?: boolean;
  hasNft?: boolean;
  currentSection: AsssetKey;
  style?: ViewStyle;
};

const TOOLTIP_CONFIG = {
  backgroundColor: 'black',
  width: 78,
};

export const AssestAllHeader = memo(
  ({ hasDefi, hasToken, hasNft, onPress, style, currentSection }: Props) => {
    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });
    const [showDefiTip, setShowDefiTip] = useState(false);
    const [showNftTip, setShowNftTip] = useState(false);
    const [showTokenTip, setShowTokenTip] = useState(false);
    const handlePress = (key: AsssetKey) => {
      if (!hasDefi && key === 'defi') {
        setShowDefiTip(true);
        return;
      }
      if (!hasNft && key === 'nft') {
        setShowNftTip(true);
        return;
      }
      if (!hasToken && key === 'token') {
        setShowTokenTip(true);
        return;
      }
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      onPress?.(key);
    };
    const onClose = () => {
      setShowDefiTip(false);
      setShowNftTip(false);
      setShowTokenTip(false);
    };

    return (
      <View style={[styles.constainer, style]}>
        <Tooltip
          {...TOOLTIP_CONFIG}
          visible={showTokenTip}
          popover={
            <Text style={styles.tooltipText}>
              {t('page.singleHome.sectionHeader.NoData', {
                name: t('page.singleHome.sectionHeader.Token'),
              })}
            </Text>
          }
          onClose={onClose}>
          <Pressable onPress={() => handlePress('token')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'token' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Token')}
            </Text>
          </Pressable>
        </Tooltip>
        <Tooltip
          {...TOOLTIP_CONFIG}
          visible={showDefiTip}
          popover={
            <Text style={styles.tooltipText}>
              {t('page.singleHome.sectionHeader.NoData', {
                name: t('page.singleHome.sectionHeader.Defi'),
              })}
            </Text>
          }
          onClose={onClose}>
          <Pressable onPress={() => handlePress('defi')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'defi' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Defi')}
            </Text>
          </Pressable>
        </Tooltip>

        <Tooltip
          {...TOOLTIP_CONFIG}
          visible={showNftTip}
          popover={
            <Text style={styles.tooltipText}>
              {t('page.singleHome.sectionHeader.NoData', {
                name: t('page.singleHome.sectionHeader.Nft'),
              })}
            </Text>
          }
          onClose={onClose}>
          <Pressable onPress={() => handlePress('nft')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'nft' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Nft')}
            </Text>
          </Pressable>
        </Tooltip>
      </View>
    );
  },
);

const getStyle = createGetStyles2024(ctx => ({
  constainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: ASSETS_SECTION_HEADER,
  },
  symbol: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
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
}));
