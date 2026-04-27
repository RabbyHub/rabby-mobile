import { Text } from '@/components/Typography';
import dappList from '@/constant/hot-dapp.json';
import { DappInfo } from '@/core/services/dappService';
import { useTheme2024 } from '@/hooks/theme';
import { useDapps } from '@/hooks/useDapps';
import { DappIcon } from '@/screens/Dapps/components/DappIcon';
import { matomoRequestEvent } from '@/utils/analytics';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList as RNFlatList,
  FlatListProps,
  GestureResponderEvent,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureDetector, NativeGesture } from 'react-native-gesture-handler';
import Animated, {
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import {
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';

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
  onDappPress?: (item: DappInfo) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  category,
  onDappPress,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const pressStartRef = useRef({ x: 0, y: 0 });
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
        drawerScrollOffsetY.value = lockPosition;
        return;
      }
      drawerScrollOffsetY.value = event.contentOffset.y;
    },
  });

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  }, []);

  const shouldIgnorePress = useCallback((event: GestureResponderEvent) => {
    const diffX = event.nativeEvent.pageX - pressStartRef.current.x;
    const diffY = event.nativeEvent.pageY - pressStartRef.current.y;
    return Math.hypot(diffX, diffY) > 10;
  }, []);

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
              <View style={styles.listItemContent}>
                <TouchableOpacity
                  onPressIn={handlePressIn}
                  onPress={event => {
                    if (shouldIgnorePress(event)) {
                      return;
                    }

                    onDappPress?.(item);
                    matomoRequestEvent({
                      category: 'Websites Usage',
                      action: 'Website_Visit_Other',
                      label: item.origin,
                    });
                  }}>
                  <View style={styles.dappCard}>
                    <DappIcon
                      source={
                        item?.icon
                          ? {
                              uri: item.icon,
                            }
                          : undefined
                      }
                      origin={item.origin}
                      style={styles.dappIcon}
                    />
                    <View style={styles.dappContent}>
                      <Text style={styles.dappTitle} numberOfLines={1}>
                        {item?.info?.name ||
                          item.name ||
                          item.origin.split('://')[1] ||
                          item.origin}
                      </Text>
                      <Text style={styles.dappDesc} numberOfLines={1}>
                        {item.info?.description || ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </GestureDetector>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {},
  listContentContainer: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 8,
  },
  emptyListContentContainer: {
    justifyContent: 'center',
  },
  listItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  listItemContent: {
    width: '100%',
    flex: 1,
  },
  dappCard: {
    paddingVertical: 12,
    paddingLeft: 4,
    paddingRight: 8,
    minHeight: 70,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    gap: 8,
  },
  dappIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  dappTitle: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 20,
    color: colors2024['neutral-title-1'],
  },
  dappContent: {
    minWidth: 0,
    flex: 1,
  },
  dappDesc: {
    marginTop: 4,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 18,
    color: colors2024['neutral-secondary'],
  },
}));
