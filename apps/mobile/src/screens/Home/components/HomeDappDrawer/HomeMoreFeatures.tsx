import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
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
import type { SharedValue } from 'react-native-reanimated';

import RcImgMoreFeaturesEmpty from '@/assets2024/icons/home/more-features-empty.svg';
import RcIconDoubleArrowCC from '@/assets2024/icons/common/double-arrow-cc.svg';
import { Text } from '@/components/Typography';
import { Button } from '@/components2024/Button';
import { ITEM_LAYOUT_PADDING_HORIZONTAL } from '@/constant/home';
import { useWindowDimensions } from '@/core/dimensions';
import { useTheme2024 } from '@/hooks/theme';
import { useSafeSizes } from '@/hooks/useAppLayout';
import { createGetStyles2024 } from '@/utils/styles';
import {
  useHasMoreHomeFeatures,
  useIsHomeFeatureEditing,
} from '../../hooks/homeFeatureLayout';
import {
  SCROLLABLE_DECELERATION_RATE_MAPPER,
  SCROLLABLE_STATUS,
} from '../../hooks/useHomeDrawerAnimate';
import { HOME_FEATURE_EDIT_FOOTER_HEIGHT } from '../HomeFeatures/constants';
import { HomeFeatureGrid } from '../HomeFeatures/HomeFeatureGrid';
import { DRAWER_MORE_CONTENT_GAP, DRAWER_TOP_BAR_HEIGHT } from './constants';

type HomeMoreFeaturesProps = {
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: SharedValue<number>;
  scrollableStatus: SharedValue<SCROLLABLE_STATUS>;
  isActive: boolean;
  /** The empty state's way on to the website pages. */
  onPressWebsites: () => void;
};

/**
 * First page of the second floor: the feature cards the user keeps off the
 * Home, or an empty state once every card lives on the Home.
 *
 * It is a scroll view tied to the drawer gesture exactly like the website
 * lists, even though its content rarely scrolls: a page with no vertical
 * scroll view of its own leaves a vertical drag to the pager's recognizer on
 * iOS, and the drawer could then not be pulled down from it.
 *
 * The scroll view starts under the floating title row and indicator, like
 * the Home's own list under its header: cards scrolled up are clipped at
 * that edge instead of showing through the title.
 */
export const HomeMoreFeatures = React.memo(function HomeMoreFeatures({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  isActive,
  onPressWebsites,
}: HomeMoreFeaturesProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const hasFeatures = useHasMoreHomeFeatures();
  const isEditing = useIsHomeFeatureEditing();
  const { height: windowHeight } = useWindowDimensions();
  const { safeHeaderTop } = useSafeSizes();
  // The design centres the empty state on the screen, not on what the title
  // row leaves of this page. The scroll view starts at
  // `safeHeaderTop + DRAWER_TOP_BAR_HEIGHT` on the open second floor.
  const emptyPositionStyle = useMemo(
    () => ({
      top: windowHeight / 2 - safeHeaderTop - DRAWER_TOP_BAR_HEIGHT,
    }),
    [safeHeaderTop, windowHeight],
  );

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();
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
    <View style={styles.page}>
      <GestureDetector gesture={drawerScrollableGesture}>
        <Animated.ScrollView
          ref={scrollableRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            isEditing && styles.editingContent,
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          animatedProps={animatedProps}>
          {hasFeatures && <HomeFeatureGrid place="more" />}
          <View
            style={[
              styles.swipeDownHint,
              !hasFeatures && styles.swipeDownHintEmpty,
            ]}>
            <RcIconDoubleArrowCC
              style={styles.swipeDownIcon}
              color={colors2024['neutral-secondary']}
            />
            <Text style={styles.swipeDownHintText}>
              {isEditing
                ? t('page.home.moreFeatures.swipeDownEdit')
                : t('page.home.moreFeatures.swipeDown')}
            </Text>
          </View>
          {!hasFeatures && (
            <View
              style={[styles.empty, emptyPositionStyle]}
              pointerEvents="box-none">
              <RcImgMoreFeaturesEmpty width={163} height={126} />
              <Text style={styles.emptyText}>
                {t('page.home.moreFeatures.empty')}
              </Text>
              <Button
                testID="home-more-features-empty-websites"
                title={t('page.home.moreFeatures.goWebsites')}
                noShadow
                containerStyle={styles.emptyButtonContainer}
                buttonStyle={styles.emptyButton}
                titleStyle={styles.emptyButtonText}
                onPress={onPressWebsites}
              />
            </View>
          )}
        </Animated.ScrollView>
      </GestureDetector>
    </View>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    flex: 1,
    paddingTop: DRAWER_TOP_BAR_HEIGHT,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: DRAWER_MORE_CONTENT_GAP,
    paddingBottom: 24,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
  },
  // Out of the flow, so the hint above keeps its place at the top of the
  // page and the group is centred on `emptyPositionStyle.top`.
  empty: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
    transform: [{ translateY: '-50%' }],
  },
  // Room for the edit footer pinned over the bottom of this page.
  editingContent: {
    paddingBottom: HOME_FEATURE_EDIT_FOOTER_HEIGHT,
  },
  emptyText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
  // 16 under the text: the group's own gap of 4, plus 12.
  emptyButtonContainer: {
    marginTop: 12,
  },
  // 34 high and 12 of padding on each side, both counting the shared
  // Button's 1pt border.
  emptyButton: {
    width: 'auto',
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderCurve: 'continuous',
  },
  emptyButtonText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 18,
  },
  swipeDownHint: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // With no cards the hint comes 20 under the title row, as it does under
  // the cards: the content already starts `DRAWER_MORE_CONTENT_GAP` down.
  swipeDownHintEmpty: {
    marginTop: 20 - DRAWER_MORE_CONTENT_GAP,
  },
  swipeDownIcon: {
    transform: [{ rotate: '180deg' }],
  },
  swipeDownHintText: {
    marginTop: 4,
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: colors2024['neutral-secondary'],
  },
}));
