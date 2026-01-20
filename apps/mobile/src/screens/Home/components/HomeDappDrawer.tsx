import { RcNextSearchCC } from '@/assets/icons/common';
import RcIconEmptyDark from '@/assets/icons/dapp/dapp-favorite-empty-dark.svg';
import RcIconEmpty from '@/assets/icons/dapp/dapp-favorite-empty.svg';
import { ReactIconHome } from '@/assets2024/icons/browser';
import RcIconDelete from '@/assets2024/icons/common/delete-cc.svg';
import { Button } from '@/components2024/Button';
import { IS_ANDROID } from '@/core/native/utils';
import { DappInfo } from '@/core/services/dappService';
import { useBrowser } from '@/hooks/browser/useBrowser';
import { useBrowserBookmark } from '@/hooks/browser/useBrowserBookmark';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { BrowserSiteCard } from '@/screens/Browser/components/BrowserSiteCard';
import { triggerImpact } from '@/utils/common';
import { createGetStyles2024 } from '@/utils/styles';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dimensions,
  FlatListProps,
  Platform,
  FlatList as RNFlatList,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolate,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  homeDrawerAnimateMutable,
  PULL_THRESHOLD,
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../hooks/useHomeDrawerAnimate';

const AnimatedFlatList =
  Animated.createAnimatedComponent<FlatListProps<DappInfo>>(RNFlatList);

export const HomeDappDrawer: React.FC = () => {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle,
  });
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  // const { height } = useWindowDimensions();
  const height = Dimensions.get('screen').height;
  const { safeTop, headerHeight } = useSafeSizes();
  const offsetTop = useMemo(() => {
    return Math.max(safeTop, headerHeight);
  }, [headerHeight, safeTop]);

  const { openTab, setPartialBrowserState } = useBrowser();
  const { bookmarkList, removeBookmark } = useBrowserBookmark();
  const [isEditing, setIsEditing] = React.useState(false);
  const [removedItems, setRemovedItems] = useState<string[]>([]);
  const list = useMemo(() => {
    return bookmarkList.filter(item => !removedItems.includes(item.origin));
  }, [bookmarkList, removedItems]);

  const startEditing = () => {
    setIsEditing(true);
    setRemovedItems([]);
  };

  const completeEditing = () => {
    setIsEditing(false);
    removedItems.forEach(url => {
      removeBookmark(url);
    });
  };

  const handleRemoveLocal = (url: string) => {
    setRemovedItems(prev => [...prev, url]);
  };

  const handle = () => {
    if (isEditing) {
      completeEditing();
    } else {
      startEditing();
    }
  };

  const onPressHome = () => {
    translateY.value = withTiming(0);
    triggerImpact();
  };

  const { pullPercent, isExpanded, translateY } = homeDrawerAnimateMutable;
  const drawerScrollOffsetY = useSharedValue(0);
  const scrollableRef = useAnimatedRef<Animated.FlatList<DappInfo>>();
  const scrollableStatus = useSharedValue<SCROLLABLE_STATUS>(
    SCROLLABLE_STATUS.UNLOCKED,
  );

  const animatedProps = useAnimatedProps(() => ({
    decelerationRate:
      SCROLLABLE_DECELERATION_RATE_MAPPER[scrollableStatus.value],
  }));

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event, context) => {
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

  const drawerGesture = useMemo(
    () =>
      Gesture.Pan()
        .onChange(event => {
          'worklet';

          if (drawerScrollOffsetY.value > 0) {
            return;
          }

          if (Math.abs(pullPercent.value) >= 100) {
            scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
          } else {
            scrollableStatus.value = SCROLLABLE_STATUS.LOCKED;
          }
          translateY.value = (height - event.translationY) * -1;
        })
        .onEnd(() => {
          'worklet';

          if (translateY.value > (height - PULL_THRESHOLD) * -1) {
            translateY.value = withTiming(0, undefined, () => {
              scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
            });
            runOnJS(triggerImpact)();
          } else {
            translateY.value = withTiming(-height, undefined, () => {
              scrollableStatus.value = SCROLLABLE_STATUS.UNLOCKED;
            });
          }
        }),
    [
      drawerScrollOffsetY,
      height,
      pullPercent.value,
      scrollableStatus,
      translateY,
    ],
  );

  const drawerScrollableGesture = useMemo(
    () =>
      Gesture.Native()
        .simultaneousWithExternalGesture(drawerGesture)
        .shouldCancelWhenOutside(false),
    [drawerGesture],
  );

  const drawerTranslateYStyle = useAnimatedStyle(() => {
    return {
      height: height,
      transform: [
        {
          translateY: interpolate(
            pullPercent.value,
            [-100, 0],
            [0, height],
            Extrapolate.CLAMP,
          ),
        },
      ],
      paddingTop: interpolate(
        pullPercent.value,
        [-100, 0],
        [offsetTop, 0],
        Extrapolate.CLAMP,
      ),
    };
  }, [height, offsetTop]);

  const panelScaleStyle = useAnimatedStyle(() => {
    return IS_ANDROID
      ? {}
      : {
          transformOrigin: 'top',
          transform: [
            {
              scale: interpolate(
                pullPercent.value,
                [0, -100],
                isExpanded.value ? [1, 1] : [0.75, 1],
                Extrapolate.CLAMP,
              ),
            },
          ],
        };
  }, [isExpanded]);

  const overlayOpacityStyle = useAnimatedStyle(() => {
    return IS_ANDROID
      ? {
          opacity: 0,
        }
      : {
          opacity: isExpanded.value
            ? 0
            : interpolate(
                pullPercent.value,
                [-100, -100 * 0.3, 0],
                [0, 0.75, 0],
                Extrapolate.CLAMP,
              ),
        };
  }, []);

  return (
    <GestureDetector gesture={drawerGesture}>
      <Animated.View
        pointerEvents="auto"
        style={[styles.pullUpPanel, drawerTranslateYStyle]}>
        <Animated.View style={[styles.pullOverlay, overlayOpacityStyle]} />
        <Animated.View style={[panelScaleStyle]}>
          <View style={styles.page}>
            <View style={styles.favoritesList}>
              <View style={styles.container}>
                <View style={styles.header}>
                  <Text style={styles.title}>
                    {t('page.home.DappDrawer.favorite')}
                  </Text>
                  <TouchableOpacity onPress={handle}>
                    <Text style={styles.edit}>
                      {isEditing ? t('global.Done') : t('global.Edit')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <GestureDetector gesture={drawerScrollableGesture}>
                  <AnimatedFlatList
                    data={list}
                    style={[styles.list]}
                    keyExtractor={item => item.url || item.origin}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                      { flexGrow: 1 },
                      list.length ? null : { justifyContent: 'center' },
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
                                handleRemoveLocal(item.origin);
                              }}>
                              <RcIconDelete width={20} height={20} />
                            </TouchableOpacity>
                          ) : null}
                          <View style={styles.listItemContent}>
                            <BrowserSiteCard
                              data={item}
                              onPress={() => {
                                if (isEditing) {
                                  return;
                                }
                                openTab(item.url || item.origin);
                              }}
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
              </View>
            </View>

            <View
              style={[
                styles.footer,
                {
                  paddingBottom:
                    Platform.OS === 'ios' ? bottom : Math.max(bottom, 12),
                },
              ]}>
              <TouchableOpacity onPress={onPressHome}>
                <ReactIconHome
                  width={44}
                  height={44}
                  color={colors2024['neutral-title-1']}
                  backgroundColor={colors2024['neutral-bg-5']}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.fabContainer]}
                onPress={() => {
                  setPartialBrowserState({
                    isShowBrowser: true,
                    isShowSearch: true,
                    searchText: '',
                    searchTabId: '',
                    trigger: 'home',
                  });
                }}>
                <View style={styles.innerCircle}>
                  <RcNextSearchCC
                    width={20}
                    height={20}
                    style={styles.icon}
                    color={colors2024['neutral-secondary']}
                  />
                  <Text style={styles.text}>
                    {t('page.browser.BrowserSearchEntry.searchWebsite')}
                  </Text>
                  <View style={{ width: 20 }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  pullUpPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  pullOverlay: {
    position: 'absolute',
    top: -90,
    transform: [{ translateX: -501 }],
    left: '50%',
    height: 1002,
    width: 1002,
    borderRadius: 10000,
    backgroundColor: colors2024['brand-light-1'],
    zIndex: 10,
    pointerEvents: 'none',
  },

  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  favoritesList: {
    flex: 1,
  },

  fabContainer: {
    flex: 1,
  },
  gradient: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-5'],
  },
  innerCircle: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors2024['neutral-bg-5'],
    position: 'relative',
    paddingLeft: 12,
    paddingRight: 12,
  },
  icon: {},
  text: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    flex: 1,
    textAlign: 'center',
    color: colors2024['neutral-foot'],
  },
  navControlItem: {
    flexShrink: 0,
  },

  browserSearch: {
    paddingTop: 18,
  },

  footer: {
    backgroundColor: colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingVertical: 12,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },

  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 20,
  },
  header: {
    paddingHorizontal: 8 + 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '800',
  },
  edit: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 18,
  },

  grid: {
    gap: 8,
  },

  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
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
