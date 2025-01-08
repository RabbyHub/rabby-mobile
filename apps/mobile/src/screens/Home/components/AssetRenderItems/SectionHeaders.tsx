import { View, Text, Pressable, ViewStyle } from 'react-native';
import React, { memo, useCallback, useState } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { trigger } from 'react-native-haptic-feedback';
import { ActionHeaderType, ActionItem } from '../../types';
import { atom, useAtom } from 'jotai';
import Animated from 'react-native-reanimated';

type Props = {
  onPress: (key: ActionHeaderType) => void;
  showToken?: boolean;
  showDefi?: boolean;
  showNft?: boolean;
  style?: ViewStyle;
};

export function mapItemTypeToHeaderType(itemType: ActionItem['type']) {
  switch (itemType) {
    case 'token_header':
    case 'unfold_token':
    case 'toggle_token_fold':
    case 'fold_token':
      return 'token_header' as const;
    case 'defi_header':
    case 'unfold_defi':
    case 'toggle_defi_fold':
    case 'fold_defi':
      return 'defi_header' as const;
    case 'nft_header':
    case 'unfold_nft':
    case 'toggle_nft_fold':
    case 'fold_nft':
      return 'nft_header' as const;
    default:
      return null;
  }
}

const currentSectionAtom = atom<ActionHeaderType>('token_header');

export function useCurrentSection() {
  const [currentSection, setCurrentSection] = useAtom(currentSectionAtom);

  return { currentSection, setCurrentSection };
}

export const AssestAllHeader = memo(
  ({ showDefi, showToken, showNft, onPress, style }: Props) => {
    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });
    const { currentSection } = useCurrentSection();
    const handlePress = useCallback(
      (key: ActionHeaderType) => {
        trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
        // setCurrentSection(key);
        onPress?.(key);
      },
      [onPress],
    );

    return (
      <Animated.View
        style={[
          styles.constainer,
          style,
          // currentIsNotRendered && styles.inactive,
          // animatedStyles,
        ]}>
        {showToken && (
          <Pressable onPress={() => handlePress('token_header')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'token_header' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Token')}
            </Text>
          </Pressable>
        )}
        {showDefi && (
          <Pressable onPress={() => handlePress('defi_header')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'defi_header' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Defi')}
            </Text>
          </Pressable>
        )}
        {showNft && (
          <Pressable onPress={() => handlePress('nft_header')}>
            <Text
              style={[
                styles.symbol,
                currentSection === 'nft_header' && styles.active,
              ]}>
              {t('page.singleHome.sectionHeader.Nft')}
            </Text>
          </Pressable>
        )}
      </Animated.View>
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
  inactive: {
    opacity: 0,
    height: 0,
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

export function AssestHeaderPlaceHolder() {
  const { styles } = useTheme2024({ getStyle });

  return (
    <View style={[styles.constainer, { height: ASSETS_SECTION_HEADER }]}></View>
  );
}
