import { View, Text, Pressable, ViewStyle } from 'react-native';
import React, { memo, useState } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { trigger } from 'react-native-haptic-feedback';

export type AsssetKey = 'token' | 'defi' | 'nft';
type Props = {
  onPress: (key: AsssetKey) => void;
  showToken?: boolean;
  showDefi?: boolean;
  showNft?: boolean;
  currentSection: AsssetKey;
  setCurrentSection: React.Dispatch<React.SetStateAction<AsssetKey>>;
  style?: ViewStyle;
};

export const AssestAllHeader = memo(
  ({
    showDefi,
    showToken,
    showNft,
    onPress,
    style,
    currentSection,
    setCurrentSection,
  }: Props) => {
    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });
    const handlePress = (key: AsssetKey) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setCurrentSection(key);
      onPress?.(key);
    };

    return (
      <View style={[styles.constainer, style]}>
        {showToken && (
          <Pressable onPress={() => handlePress('token')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'token' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Token')}
            </Text>
          </Pressable>
        )}
        {showDefi && (
          <Pressable onPress={() => handlePress('defi')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'defi' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Defi')}
            </Text>
          </Pressable>
        )}
        {showNft && (
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
}));
