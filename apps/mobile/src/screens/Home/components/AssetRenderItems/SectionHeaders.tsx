import { View, Text, Pressable, ViewStyle } from 'react-native';
import React, { memo } from 'react';
import { ASSETS_SECTION_HEADER } from '@/constant/layout';
import { createGetStyles2024 } from '@/utils/styles';
import { useTranslation } from 'react-i18next';
import { useTheme2024 } from '@/hooks/theme';
import { trigger } from 'react-native-haptic-feedback';
import { PositionLoader } from '../Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';

export type AsssetKey = 'token' | 'defi' | 'nft';
type Props = {
  onPress: (key: AsssetKey) => void;
  showToken?: boolean;
  showDefi?: boolean;
  showNft?: boolean;
  loading?: boolean;
  hasAssets?: boolean;
  currentSection: AsssetKey;
  style?: ViewStyle;
};

export const AssestAllHeader = memo(
  ({
    showDefi,
    showToken,
    showNft,
    onPress,
    style,
    loading,
    hasAssets,
    currentSection,
  }: Props) => {
    const { t } = useTranslation();
    const { styles } = useTheme2024({ getStyle });
    const handlePress = (key: AsssetKey) => {
      trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      onPress?.(key);
    };

    if (hasAssets) {
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
    }
    if (loading) {
      return <PositionLoader length={7} space={8} />;
    }
    return (
      <View style={styles.emptyHolder}>
        <EmptyHolder
          imgStyle={styles.emptyImg}
          textStyle={styles.emptyText}
          text="No Assets"
          type="default"
        />
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
}));
