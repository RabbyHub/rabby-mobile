import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import RcIconFavorite from '@/assets2024/icons/home/favorite.svg';

export type FavoriteFilterType = 'all' | 'favorite';

interface FavoriteFilterItemProps {
  value: FavoriteFilterType;
  onChange: (value: FavoriteFilterType) => void;
  style?: any;
}

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      height: 31,
      gap: 8,
    },
    filterButton: {
      height: 29,
      width: 42,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors2024['neutral-bg-5'],
      borderWidth: 1,
      borderColor: 'transparent',
    },
    filterButtonActive: {
      backgroundColor: colors2024['brand-light-1'],
      borderColor: colors2024['brand-disable'],
    },
    filterButtonText: {
      color: colors2024['neutral-body'],
      fontSize: 14,
      fontWeight: '700',
      fontFamily: 'SF Pro Rounded',
    },
    filterButtonTextActive: {
      color: colors2024['brand-default'],
    },
    favoriteIcon: {
      width: 18,
      height: 18,
    },
  };
});

export default function FavoriteFilterItem({
  value,
  onChange,
  style,
}: FavoriteFilterItemProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          value === 'favorite' && styles.filterButtonActive,
        ]}
        onPress={() => onChange(value === 'favorite' ? 'all' : 'favorite')}>
        <RcIconFavorite
          width={18}
          height={18}
          style={styles.favoriteIcon}
          color={colors2024['orange-default']}
        />
      </TouchableOpacity>
    </View>
  );
}
