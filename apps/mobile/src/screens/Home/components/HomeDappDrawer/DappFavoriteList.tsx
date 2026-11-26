import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-favorite-empty-dark.svg';
import RcIconDelete from '@/assets2024/icons/common/delete-cc.svg';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { IS_ANDROID } from '@/core/native/utils';
import type { DappInfo } from '@/core/services/dappService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { useWindowDimensions } from '@/core/dimensions';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import { stringUtils } from '@rabby-wallet/base-utils';
import { useMemoizedFn } from 'ahooks';
import React, { useEffect, useMemo } from 'react';
import type { FlatListProps } from 'react-native';
import { FlatList as RNFlatList, TouchableOpacity, View } from 'react-native';
import type { NativeGesture } from 'react-native-gesture-handler';
import { GestureDetector } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
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
import { DRAWER_DAPP_CARD_GAP, DRAWER_WEBSITES_CONTENT_TOP } from './constants';
import { HomeDrawerDappCard } from './HomeDrawerDappCard';

const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

export const DappFavoriteList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
  bookmarkList: DappInfo[];
  isEditing: boolean;
  isActive?: boolean;
  onRemoveLocal?: (url: string) => void;
  onDappPress?: (dapp: DappInfo) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  bookmarkList,
  isEditing,
  isActive = false,
  onRemoveLocal,
  onDappPress,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { openTab, setPartialBrowserState } = useBrowser();
  const { height: windowHeight } = useWindowDimensions();
  const { safeHeaderTop } = useSafeSizes();
  // The design centres the empty state on the screen, as on "More
  // Features". The list starts at `safeHeaderTop +
  // DRAWER_WEBSITES_CONTENT_TOP` on the open second floor, and an absolute
  // child is placed from its parent's padding edge, so the list's own top
  // padding does not count.
  const emptyPositionStyle = useMemo(
    () => ({
      top: windowHeight / 2 - safeHeaderTop - DRAWER_WEBSITES_CONTENT_TOP,
    }),
    [safeHeaderTop, windowHeight],
  );

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

  const handleDappPress = useMemoizedFn((item: DappInfo) => {
    if (isEditing) {
      return;
    }

    // openTab(item.url || item.origin);
    onDappPress?.(item);
  });

  return (
    <GestureDetector gesture={drawerScrollableGesture}>
      <AnimatedFlatList
        data={bookmarkList}
        style={styles.list}
        keyExtractor={item => item.url || item.origin}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.listContentContainer}
        ref={scrollableRef}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        animatedProps={animatedProps}
        renderItem={({ item }) => {
          return (
            <View style={styles.listItem}>
              {isEditing ? (
                <TouchableOpacity
                  onPress={() => {
                    onRemoveLocal?.(item.origin);
                  }}>
                  <RcIconDelete width={20} height={20} />
                </TouchableOpacity>
              ) : null}
              <View style={styles.listItemContent}>
                <HomeDrawerDappCard
                  dapp={item}
                  title={item.name}
                  description={stringUtils.unPrefix(item.origin, 'https://')}
                  onPress={handleDappPress}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View
            style={[styles.empty, emptyPositionStyle]}
            pointerEvents="box-none">
            {isLight ? (
              <RcIconEmpty style={styles.emptyIcon} />
            ) : (
              <RcIconEmptyDark style={styles.emptyIcon} />
            )}
            <Text style={styles.emptyText}>
              {IS_ANDROID
                ? t('page.home.DappDrawer.emptyAndroid')
                : t('page.home.DappDrawer.empty')}
            </Text>
            <Button
              title={t('page.home.DappDrawer.search')}
              noShadow
              containerStyle={styles.searchButtonContainer}
              buttonStyle={styles.searchButton}
              titleStyle={styles.searchButtonText}
              onPress={() => {
                setPartialBrowserState({
                  isShowBrowser: true,
                  isShowSearch: true,
                  searchText: '',
                  searchTabId: '',
                  trigger: 'home',
                });
              }}
            />
          </View>
        }
      />
    </GestureDetector>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  list: {
    // minHeight: 0,
  },
  listContentContainer: {
    flexGrow: 1,
    paddingTop: DRAWER_DAPP_CARD_GAP,
  },
  listItem: {
    marginBottom: DRAWER_DAPP_CARD_GAP,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  listItemContent: {
    flex: 1,
    minWidth: 0,
  },
  // Out of the flow and centred on `emptyPositionStyle.top`.
  empty: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    transform: [{ translateY: '-50%' }],
  },
  emptyIcon: {
    width: 163,
    height: 126,
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
  // 16 under the text: the group's own gap of 4, plus 12.
  searchButtonContainer: {
    marginTop: 12,
  },
  searchButton: {
    height: 36,
    width: 121,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  searchButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
