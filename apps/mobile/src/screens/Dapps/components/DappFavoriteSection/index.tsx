import RcIconRight from '@/assets/icons/dapp/icon-right.svg';
import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import { RootNames } from '@/constant/layout';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React, { useMemo, useState } from 'react';
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
  const [isFold, setIsFold] = useState(true);

  const { list } = useMemo(() => {
    return {
      list: isFold ? (data || []).slice(0, 8) : data || [],
    };
  }, [data, isFold]);

  const { width } = useWindowDimensions();
  const gapStyle = useMemo(() => {
    return {
      columnGap: Math.floor((width - 48 - 56 * 4) / 3),
    };
  }, [width]);

  return (
    <View style={[styles.container, style]}>
      {list?.length ? (
        <>
          <View style={styles.header}>
            <View style={styles.titleWarper}>
              <Text style={styles.title}>Favorites</Text>
            </View>
            {data?.length && data.length > 8 ? (
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  setIsFold(prev => !prev);
                }}>
                {isFold ? (
                  <View style={styles.headerExtra}>
                    <Text style={styles.headerExtraText}>All</Text>
                    <RcIconRight />
                  </View>
                ) : (
                  <View style={styles.headerExtra}>
                    <Text style={styles.headerExtraText}>Fold</Text>
                    <RcIconRight />
                  </View>
                )}
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={[styles.list, gapStyle]}>
            {list.map(item => {
              return (
                <View key={item.origin} style={styles.item}>
                  <DappFavoriteItem data={item} onPress={onPress} />
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <DappFavoriteSectionEmpty />
      )}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    marginBottom: 30,
    paddingHorizontal: 24,
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
