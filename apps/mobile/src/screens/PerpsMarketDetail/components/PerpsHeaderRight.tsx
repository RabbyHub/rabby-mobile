/* eslint-disable react-native/no-inline-styles */
import { TouchableOpacity } from 'react-native';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback, useMemo } from 'react';
import {
  addFavoriteMarket,
  perpsStore,
  removeFavoriteMarket,
} from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/shallow';

interface Props {
  marketName: string;
}

export const PerpsHeaderRight: React.FC<Props> = ({ marketName }) => {
  const { colors2024 } = useTheme2024();
  const { favoriteMarkets } = perpsStore(
    useShallow(s => ({
      favoriteMarkets: s.favoriteMarkets,
    })),
  );

  const isFavorite = useMemo(() => {
    return favoriteMarkets.includes(marketName.toUpperCase());
  }, [favoriteMarkets, marketName]);

  const handlePress = useCallback(async () => {
    if (isFavorite) {
      removeFavoriteMarket(marketName);
    } else {
      addFavoriteMarket(marketName);
    }
  }, [isFavorite, marketName]);

  return (
    <TouchableOpacity onPress={handlePress}>
      <RcIconFavorite
        width={22}
        height={21}
        color={
          isFavorite ? colors2024['orange-default'] : colors2024['neutral-info']
        }
      />
    </TouchableOpacity>
  );
};
