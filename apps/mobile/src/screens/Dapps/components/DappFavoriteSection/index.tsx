import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import { RootNames } from '@/constant/layout';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React, { useMemo } from 'react';
import {
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { DappFavoriteItem } from './DappFavoriteItem';
import { DappFavoriteSectionEmpty } from './DappFavoriteSectionEmpty';

export const DappFavoriteSection = ({
  data,
  onPress,
  style,
}: {
  data?: DappInfo[];
  style?: StyleProp<ViewStyle>;
  onPress?: (dapp: DappInfo) => void;
}) => {
  const { styles } = useTheme2024({ getStyle });

  const handlePressAll = useMemoizedFn(() => {
    naviPush(RootNames.StackDapps, {
      screen: RootNames.FavoriteDapps,
    });
  });

  const list = useMemo(() => {
    return (data || []).slice(0, 8);
  }, [data]);

  const { width } = useWindowDimensions();
  const gapStyle = useMemo(() => {
    return {
      columnGap: Math.floor((width - 48 - 56 * 4) / 3),
    };
  }, [width]);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.titleWarper}>
          <Text style={styles.title}>Favorites</Text>
        </View>
        {data?.length ? (
          <TouchableOpacity hitSlop={8} onPress={handlePressAll}>
            <View style={styles.headerExtra}>
              <Text style={styles.headerExtraText}>All</Text>
              <RcIconRight />
            </View>
          </TouchableOpacity>
        ) : null}
      </View>
      {list?.length ? (
        <View style={[styles.list, gapStyle]}>
          {list.map(item => {
            return (
              <View key={item.origin} style={styles.item}>
                <DappFavoriteItem data={item} onPress={onPress} />
              </View>
            );
          })}
        </View>
      ) : (
        <DappFavoriteSectionEmpty />
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginBottom: 30,
    paddingHorizontal: 4,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWarper: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 'auto',
  },
  title: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
    color: colors2024['neutral-title-1'],
  },
  headerExtra: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerExtraText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
  },
  list: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  item: {
    // width: '25%',
    width: 56,
  },
}));
