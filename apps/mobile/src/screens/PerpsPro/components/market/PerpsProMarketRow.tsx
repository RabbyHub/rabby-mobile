import RcStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcStar from '@/assets/icons/dapp/icon-star.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useRef } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProMarketRowModel } from '../../model/marketSelectorProjection';
import {
  formatPerpsProCompactNumber,
  formatPerpsProPercent,
  formatPerpsProPrice,
} from '../../utils/format';
import { PerpsProMarketLogo } from './PerpsProMarketLogo';

type PerpsProMarketRowProps = {
  favorite: boolean;
  model: PerpsProMarketRowModel;
  onPrefetch?: () => void;
  onSelect: (marketKey: string) => void;
  onToggleFavorite: (marketKey: string) => void;
  selected: boolean;
};

const PerpsProMarketRowComponent: React.FC<PerpsProMarketRowProps> = ({
  favorite,
  model,
  onPrefetch,
  onSelect,
  onToggleFavorite,
  selected,
}) => {
  const { isLight, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  // A live volume reorder may rebind this physical row between press-in and
  // press. Never dispatch an action for the newly bound market in that case.
  const selectPressMarketKeyRef = useRef<string | null>(null);
  const favoritePressMarketKeyRef = useRef<string | null>(null);
  const changeStyle =
    model.change24h == null
      ? styles.changeMuted
      : model.change24h >= 0
      ? styles.changeUp
      : styles.changeDown;
  const captureSelectIdentity = useCallback(() => {
    selectPressMarketKeyRef.current = model.marketKey;
    onPrefetch?.();
  }, [model.marketKey, onPrefetch]);
  const captureFavoriteIdentity = useCallback(() => {
    favoritePressMarketKeyRef.current = model.marketKey;
  }, [model.marketKey]);
  const selectMarket = useCallback(() => {
    const pressedMarketKey = selectPressMarketKeyRef.current;
    selectPressMarketKeyRef.current = null;
    if (pressedMarketKey != null && pressedMarketKey !== model.marketKey) {
      return;
    }
    onSelect(model.marketKey);
  }, [model.marketKey, onSelect]);
  const toggleFavorite = useCallback(() => {
    const pressedMarketKey = favoritePressMarketKeyRef.current;
    favoritePressMarketKeyRef.current = null;
    if (pressedMarketKey != null && pressedMarketKey !== model.marketKey) {
      return;
    }
    onToggleFavorite(model.marketKey);
  }, [model.marketKey, onToggleFavorite]);

  return (
    <Pressable
      accessibilityLabel={t('page.perps.pro.marketSelector.select', {
        pair: model.displayPair,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={selectMarket}
      onPressIn={captureSelectIdentity}
      style={styles.marketRow}>
      <TouchableOpacity
        accessibilityLabel={
          favorite
            ? t('page.perps.pro.marketSelector.removeFavorite', {
                pair: model.displayPair,
              })
            : t('page.perps.pro.marketSelector.addFavorite', {
                pair: model.displayPair,
              })
        }
        accessibilityRole="button"
        hitSlop={8}
        onPress={event => {
          event.stopPropagation();
          toggleFavorite();
        }}
        onPressIn={captureFavoriteIdentity}
        style={styles.star}>
        {favorite ? (
          <RcStarFull height={20} width={20} />
        ) : (
          <RcStar height={20} width={20} />
        )}
      </TouchableOpacity>
      <PerpsProMarketLogo
        isLight={isLight}
        logoUrl={model.logoUrl}
        marketKey={model.marketKey}
        size={46}
        style={styles.logo}
      />
      <View style={styles.marketContent}>
        <View style={styles.heading}>
          <View style={styles.marketNameLine}>
            <Text numberOfLines={1} style={styles.marketName}>
              {model.displayPair}
            </Text>
            {model.sourceTag ? (
              <Text numberOfLines={1} style={styles.sourceTag}>
                {model.sourceTag.toUpperCase()}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.marketPrice}>
            {formatPerpsProPrice(model.price, model.pxDecimals)}
          </Text>
        </View>
        <View style={styles.subtitle}>
          <View style={styles.marketMeta}>
            {model.fullName ? (
              <Text numberOfLines={1} style={styles.marketMetaText}>
                {model.fullName}
              </Text>
            ) : null}
            {model.fullName ? <View style={styles.marketMetaDivider} /> : null}
            <Text numberOfLines={1} style={styles.marketMetaText}>
              {formatPerpsProCompactNumber(model.volume24h)}
            </Text>
          </View>
          <Text style={changeStyle}>
            {formatPerpsProPercent(model.change24h)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

export const PerpsProMarketRow = React.memo(
  PerpsProMarketRowComponent,
  (previous, next) =>
    previous.favorite === next.favorite &&
    previous.model === next.model &&
    previous.onSelect === next.onSelect &&
    previous.onToggleFavorite === next.onToggleFavorite &&
    previous.selected === next.selected,
);

PerpsProMarketRow.displayName = 'PerpsProMarketRow';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  marketRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 70,
    paddingLeft: 4,
    paddingRight: 8,
  },
  star: {
    alignItems: 'center',
    height: 20,
    justifyContent: 'center',
    marginRight: 6,
    width: 20,
  },
  logo: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 23,
    height: 46,
    width: 46,
  },
  marketContent: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 20,
    justifyContent: 'space-between',
  },
  subtitle: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 18,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  marketNameLine: {
    alignItems: 'center',
    flexShrink: 1,
    flexDirection: 'row',
    gap: 2,
    minWidth: 0,
  },
  marketName: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  sourceTag: {
    backgroundColor: colors2024['neutral-bg-5'],
    borderRadius: 4,
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    maxWidth: 52,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  marketMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minWidth: 0,
  },
  marketMetaText: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  marketMetaDivider: {
    backgroundColor: colors2024['neutral-line'],
    height: 12,
    width: 1,
  },
  marketPrice: {
    color: colors2024['neutral-title-1'],
    marginLeft: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
  },
  changeUp: {
    color: colors2024['green-default'],
    marginLeft: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  changeDown: {
    color: colors2024['red-default'],
    marginLeft: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
  changeMuted: {
    color: colors2024['neutral-secondary'],
    marginLeft: 8,
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
}));
