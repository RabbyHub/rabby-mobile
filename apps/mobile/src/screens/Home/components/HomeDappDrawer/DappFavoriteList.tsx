import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-favorite-empty-dark.svg';
import RcIconDelete from '@/assets2024/icons/common/delete-cc.svg';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { IS_ANDROID } from '@/core/native/utils';
import { DappInfo } from '@/core/services/dappService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useTheme2024 } from '@/hooks/theme';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { createGetStyles2024 } from '@/utils/styles';
import { useMemoizedFn } from 'ahooks';
import React from 'react';
import {
  FlatList as RNFlatList,
  FlatListProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureDetector, NativeGesture } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import Animated, {
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

import { matomoRequestEvent } from '@/utils/analytics';
import {
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';

const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

export const DappFavoriteList: React.FC<{
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: Animated.SharedValue<number>;
  scrollableStatus: Animated.SharedValue<SCROLLABLE_STATUS>;
  bookmarkList: DappInfo[];
  isEditing: boolean;
  onRemoveLocal?: (url: string) => void;
  onDappPress?: (dapp: DappInfo) => void;
}> = ({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  bookmarkList,
  isEditing,
  onRemoveLocal,
  onDappPress,
}) => {
  const { styles, isLight } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const { openTab, setPartialBrowserState } = useBrowser();

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

  const handleDappPress = useMemoizedFn((item: DappInfo) => {
    if (isEditing) {
      return;
    }

    // openTab(item.url || item.origin);
    onDappPress?.(item);
    matomoRequestEvent({
      category: 'Websites Usage',
      action: 'Website_Visit_Website Favorite List',
      label: item.origin,
    });
  });

  return (
    <GestureDetector gesture={drawerScrollableGesture}>
      <AnimatedFlatList
        data={bookmarkList}
        style={styles.list}
        keyExtractor={item => item.url || item.origin}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={[
          { flexGrow: 1, paddingTop: 12 },
          bookmarkList.length ? null : { justifyContent: 'center' },
        ]}
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
                <BrowserSiteCard
                  data={item}
                  onPress={handleDappPress}
                  isShowDesc={false}
                  ignorePressMoveThreshold={10}
                />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
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
  listItem: {
    marginBottom: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  listItemContent: {
    width: '100%',
  },
  empty: {
    paddingVertical: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 4,
    marginTop: -100,
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
  searchButton: {
    marginTop: 16,
    height: 42,
    width: 143,
    borderRadius: 6,
  },
  searchButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
}));
