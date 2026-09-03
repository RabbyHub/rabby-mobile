import RcFavoriteStar from '@/assets2024/icons/perps/PerpsProFavoriteStar.svg';
import RcFavoriteStarEmpty from '@/assets/icons/dapp/icon-star.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { PerpsProMarketRowModel } from '../../model/marketSelectorProjection';
import {
  formatPerpsProCompactNumber,
  formatPerpsProMarketSelectorPrice,
  formatPerpsProPercent,
} from '../../utils/format';
import {
  getPerpsProMetadataTagContainerStyle,
  getPerpsProMetadataTagTextStyle,
} from '../common/perpsProSemanticTagStyles';
import { PerpsProMarketLogo } from './PerpsProMarketLogo';
import { PERPS_PRO_MARKET_ROW_HEIGHT } from './marketLayout';

type PerpsProMarketRowProps = {
  favorite: boolean;
  model: PerpsProMarketRowModel;
  onPrefetch?: () => void;
  onRealtimeIntentCancel?: (marketKey: string) => void;
  onRealtimeIntentStart?: (marketKey: string) => void;
  onSelect: (marketKey: string) => void;
  onToggleFavorite: (marketKey: string) => void;
  selected: boolean;
};

const PerpsProMarketRowComponent: React.FC<PerpsProMarketRowProps> = ({
  favorite,
  model,
  onPrefetch,
  onRealtimeIntentCancel,
  onRealtimeIntentStart,
  onSelect,
  onToggleFavorite,
  selected,
}) => {
  const { colors2024, isLight, styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  // A live volume reorder may rebind this physical row between press-in and
  // press. Never dispatch an action for the newly bound market in that case.
  const selectPressMarketKeyRef = useRef<string | null>(null);
  const favoritePressMarketKeyRef = useRef<string | null>(null);
  const selectIdentityInvalidatedRef = useRef(false);
  const selectIntentCancelTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const changeStyle =
    model.change24h == null
      ? styles.changeMuted
      : model.change24h >= 0
      ? styles.changeUp
      : styles.changeDown;
  const captureSelectIdentity = useCallback(() => {
    selectIdentityInvalidatedRef.current = false;
    selectPressMarketKeyRef.current = model.marketKey;
    onPrefetch?.();
    onRealtimeIntentStart?.(model.marketKey);
  }, [model.marketKey, onPrefetch, onRealtimeIntentStart]);
  const cancelCapturedSelectIntent = useCallback(() => {
    if (selectIntentCancelTimerRef.current) {
      clearTimeout(selectIntentCancelTimerRef.current);
      selectIntentCancelTimerRef.current = null;
    }
    const pressedMarketKey = selectPressMarketKeyRef.current;
    selectPressMarketKeyRef.current = null;
    if (pressedMarketKey) {
      onRealtimeIntentCancel?.(pressedMarketKey);
    }
  }, [onRealtimeIntentCancel]);
  const scheduleSelectIntentCancel = useCallback(() => {
    const pressedMarketKey = selectPressMarketKeyRef.current;
    if (!pressedMarketKey) {
      return;
    }
    if (selectIntentCancelTimerRef.current) {
      clearTimeout(selectIntentCancelTimerRef.current);
    }
    // React Native may fire onPressOut immediately before onPress. Give a
    // successful press one task to transfer the same intent lease.
    selectIntentCancelTimerRef.current = setTimeout(() => {
      selectIntentCancelTimerRef.current = null;
      if (selectPressMarketKeyRef.current !== pressedMarketKey) {
        return;
      }
      selectPressMarketKeyRef.current = null;
      selectIdentityInvalidatedRef.current = true;
      onRealtimeIntentCancel?.(pressedMarketKey);
    }, 0);
  }, [onRealtimeIntentCancel]);
  const captureFavoriteIdentity = useCallback(() => {
    if (selectIntentCancelTimerRef.current) {
      clearTimeout(selectIntentCancelTimerRef.current);
      selectIntentCancelTimerRef.current = null;
    }
    if (selectPressMarketKeyRef.current) {
      onRealtimeIntentCancel?.(selectPressMarketKeyRef.current);
    }
    favoritePressMarketKeyRef.current = model.marketKey;
  }, [model.marketKey, onRealtimeIntentCancel]);
  const selectMarket = useCallback(() => {
    if (selectIntentCancelTimerRef.current) {
      clearTimeout(selectIntentCancelTimerRef.current);
      selectIntentCancelTimerRef.current = null;
    }
    if (selectIdentityInvalidatedRef.current) {
      selectIdentityInvalidatedRef.current = false;
      return;
    }
    const pressedMarketKey = selectPressMarketKeyRef.current;
    selectPressMarketKeyRef.current = null;
    if (pressedMarketKey != null && pressedMarketKey !== model.marketKey) {
      onRealtimeIntentCancel?.(pressedMarketKey);
      return;
    }
    onSelect(model.marketKey);
  }, [model.marketKey, onRealtimeIntentCancel, onSelect]);
  const toggleFavorite = useCallback(() => {
    const pressedMarketKey = favoritePressMarketKeyRef.current;
    favoritePressMarketKeyRef.current = null;
    if (pressedMarketKey != null && pressedMarketKey !== model.marketKey) {
      return;
    }
    onToggleFavorite(model.marketKey);
  }, [model.marketKey, onToggleFavorite]);

  useEffect(
    () => () => {
      const hadCapturedIdentity = selectPressMarketKeyRef.current != null;
      cancelCapturedSelectIntent();
      if (hadCapturedIdentity) {
        selectIdentityInvalidatedRef.current = true;
      }
    },
    [cancelCapturedSelectIntent, model.marketKey],
  );

  return (
    <Pressable
      accessibilityLabel={t('page.perps.pro.marketSelector.select', {
        pair: model.displayPair,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={selectMarket}
      onPressIn={captureSelectIdentity}
      onPressOut={scheduleSelectIntentCancel}
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
          <RcFavoriteStar
            color={colors2024['orange-default']}
            height={13.5445}
            width={13.6231}
          />
        ) : (
          <RcFavoriteStarEmpty height={16} width={16} />
        )}
      </TouchableOpacity>
      <PerpsProMarketLogo
        isLight={isLight}
        logoUrl={model.logoUrl}
        marketKey={model.marketKey}
        size={24}
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
                {model.sourceTag}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} style={styles.marketPrice}>
            {formatPerpsProMarketSelectorPrice(model.price, model.pxDecimals)}
          </Text>
        </View>
        <View style={styles.subtitle}>
          <View style={styles.marketMeta}>
            {model.fullName ? (
              <Text numberOfLines={1} style={styles.fullNameText}>
                {model.fullName}
              </Text>
            ) : null}
            {model.fullName ? <View style={styles.marketMetaDivider} /> : null}
            <Text numberOfLines={1} style={styles.volumeText}>
              {formatPerpsProCompactNumber(model.volume24h)}
            </Text>
          </View>
          <Text numberOfLines={1} style={changeStyle}>
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
    previous.onPrefetch === next.onPrefetch &&
    previous.onRealtimeIntentCancel === next.onRealtimeIntentCancel &&
    previous.onRealtimeIntentStart === next.onRealtimeIntentStart &&
    previous.onSelect === next.onSelect &&
    previous.onToggleFavorite === next.onToggleFavorite &&
    previous.selected === next.selected,
);

PerpsProMarketRow.displayName = 'PerpsProMarketRow';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  marketRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    height: PERPS_PRO_MARKET_ROW_HEIGHT,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  star: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginRight: 6,
    width: 16,
  },
  logo: {
    backgroundColor: colors2024['neutral-bg-0'],
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  marketContent: {
    flex: 1,
    height: 40,
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
    height: 16,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  marketNameLine: {
    alignItems: 'center',
    flexShrink: 1,
    flexDirection: 'row',
    gap: 4,
    minWidth: 0,
  },
  marketName: {
    color: colors2024['neutral-title-1'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  sourceTag: {
    ...getPerpsProMetadataTagContainerStyle(colors2024),
    ...getPerpsProMetadataTagTextStyle(colors2024),
    maxWidth: 52,
  },
  marketMeta: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    minWidth: 0,
  },
  fullNameText: {
    color: colors2024['neutral-secondary'],
    flexShrink: 1,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  volumeText: {
    color: colors2024['neutral-secondary'],
    flexShrink: 0,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
  marketMetaDivider: {
    backgroundColor: colors2024['neutral-line'],
    flexShrink: 0,
    height: 12,
    width: 1,
  },
  marketPrice: {
    color: colors2024['neutral-title-1'],
    marginLeft: 8,
    fontFamily: 'SF Pro',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
  },
  changeUp: {
    color: colors2024['green-default'],
    flexShrink: 0,
    marginLeft: 20,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  changeDown: {
    color: colors2024['red-default'],
    flexShrink: 0,
    marginLeft: 20,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  changeMuted: {
    color: colors2024['neutral-secondary'],
    flexShrink: 0,
    marginLeft: 20,
    fontFamily: 'SF Pro',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
}));
