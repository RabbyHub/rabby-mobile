import dappList from '@/constant/hot-dapp.json';
import type { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { FlatListProps } from 'react-native';
import { FlatList as RNFlatList, View } from 'react-native';
import type { NativeGesture } from 'react-native-gesture-handler';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnUI,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import {
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';
import { DRAWER_DAPP_CARD_GAP } from './constants';
import { HomeDrawerDappCard } from './HomeDrawerDappCard';

type HotDappListItem = (typeof dappList)[number];

const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

const mapHotDappListToDappInfo = ({
  dapps,
  list,
  lang,
}: {
  dapps: Record<string, DappInfo>;
  list: HotDappListItem[];
  lang: string;
}): DappInfo[] => {
  const isZh = lang.toLowerCase().startsWith('zh');

  return list.map(item => {
    const dapp = dapps[item.origin];
    return {
      ...dapp,
      origin: item.origin,
      icon: item.logo || dapp?.icon || '',
      name: item.name,
      chainId: undefined as unknown as DappInfo['chainId'],
      isDapp: true,
      info: {
        ...dapp?.info,
        id: item.origin.replace(/^https?:\/\//, ''),
        name: item.name,
        logo_url: item.logo || dapp?.icon || '',
        description: isZh ? item.zh : item.en,
        user_range: '',
        tags: item.category ? [item.category] : [],
        chain_ids: [],
      },
    };
  });
};

export const DappList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
  category: string;
  isActive?: boolean;
  onDappPress?: (item: DappInfo) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  category,
  isActive = false,
  onDappPress,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const lang = useTranslation().i18n.language;
  const { dapps } = useDapps();
  const hotDappInfoList = useMemo(
    () => mapHotDappListToDappInfo({ dapps, list: dappList, lang }),
    [dapps, lang],
  );

  const list = useMemo(() => {
    if (category === 'all') {
      return hotDappInfoList;
    }
    return hotDappInfoList.filter(item => item.info?.tags?.includes(category));
  }, [category, hotDappInfoList]);

  const scrollableRef = useAnimatedRef<Animated.FlatList<DappInfo>>();
  const localScrollOffsetY = useSharedValue(0);
  const isActiveShared = useSharedValue(isActive);

  useEffect(() => {
    isActiveShared.value = isActive;

    if (isActive) {
      runOnUI(() => {
        'worklet';

        drawerScrollOffsetY.value = localScrollOffsetY.value;
      })();
    }
  }, [drawerScrollOffsetY, isActive, isActiveShared, localScrollOffsetY]);

  const animatedProps = useAnimatedProps(() => ({
    decelerationRate:
      SCROLLABLE_DECELERATION_RATE_MAPPER[scrollableStatus.value],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      'worklet';

      if (scrollableStatus.value === SCROLLABLE_STATUS.LOCKED) {
        const lockPosition = 0;
        scrollTo(scrollableRef, 0, lockPosition, false);
        localScrollOffsetY.value = lockPosition;
        if (isActiveShared.value) {
          drawerScrollOffsetY.value = lockPosition;
        }
        return;
      }
      localScrollOffsetY.value = event.contentOffset.y;
      if (isActiveShared.value) {
        drawerScrollOffsetY.value = event.contentOffset.y;
      }
    },
  });

  return (
    <GestureDetector gesture={drawerScrollableGesture}>
      <AnimatedFlatList
        data={list}
        style={styles.list}
        keyExtractor={item => item.url || item.origin}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContentContainer,
          list.length ? null : styles.emptyListContentContainer,
        ]}
        ref={scrollableRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        animatedProps={animatedProps}
        renderItem={({ item }) => {
          return (
            <View style={styles.listItem}>
              <HomeDrawerDappCard
                dapp={item}
                title={
                  item?.info?.name ||
                  item.name ||
                  item.origin.split('://')[1] ||
                  item.origin
                }
                description={item.info?.description || ''}
                onPress={onDappPress}
              />
            </View>
          );
        }}
      />
    </GestureDetector>
  );
};

const getStyle = createGetStyles2024(() => ({
  list: {},
  listContentContainer: {
    flexGrow: 1,
    paddingTop: DRAWER_DAPP_CARD_GAP,
    paddingBottom: 8,
  },
  emptyListContentContainer: {
    justifyContent: 'center',
  },
  listItem: {
    marginBottom: DRAWER_DAPP_CARD_GAP,
  },
}));
