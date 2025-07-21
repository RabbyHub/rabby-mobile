import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import BottomArrowCC from '@/assets2024/icons/home/bottomArrow.svg';
import { AssetAvatar } from '@/components/AssetAvatar';

export const ScamTokenHeader = memo(
  ({
    total,
    style,
    onPress,
    logoUrls,
  }: {
    total: number;
    style?: ViewStyle;
    onPress?(): void;
    logoUrls?: string[];
  }) => {
    const { styles, colors2024 } = useTheme2024({
      getStyle: getStyles,
    });
    const { t } = useTranslation();

    const onPressToken = useCallback(() => {
      return onPress?.();
    }, [onPress]);

    const logoSize = useMemo(() => ({ width: 28, height: 28 }), []);

    return (
      <TouchableOpacity
        style={StyleSheet.flatten([styles.tokenRowWrap, style])}
        onPress={onPressToken}>
        <View style={styles.left}>
          <View style={styles.logo}>
            {Array.from({ length: Math.min(3, total) }).map((_, index) => (
              <AssetAvatar
                key={index}
                logo={logoUrls?.[index] || ''}
                size={28}
                style={{ ...logoSize, marginLeft: index === 0 ? 0 : -19.5 }}
              />
            ))}
          </View>
          <Text style={styles.title}>
            {t('page.multiAddressAssets.lowValueTokenHeader')}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.total}>{total}</Text>
          <BottomArrowCC color={colors2024['neutral-secondary']} />
        </View>
      </TouchableOpacity>
    );
  },
);

const getStyles = createGetStyles2024(ctx => ({
  tokenRowWrap: {
    // height: ASSETS_ITEM_HEIGHT_NEW,
    width: '100%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
    borderRadius: 16,
    paddingLeft: 12,
    paddingRight: 16,
  },
  logo: {
    flexDirection: 'row',
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  total: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: ctx.colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
}));
