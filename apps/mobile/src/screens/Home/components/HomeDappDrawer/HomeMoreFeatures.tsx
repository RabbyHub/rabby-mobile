import React, { useEffect } from 'react';
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
import { ITEM_LAYOUT_PADDING_HORIZONTAL } from '@/constant/home';
import { useTheme2024 } from '@/hooks/theme';
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
import { DRAWER_MORE_CONTENT_TOP } from './constants';

type HomeMoreFeaturesProps = {
  drawerScrollableGesture: NativeGesture;
  drawerScrollOffsetY: SharedValue<number>;
  scrollableStatus: SharedValue<SCROLLABLE_STATUS>;
  isActive: boolean;
};

/**
 * First page of the second floor: the feature cards the user keeps off the
 * Home, or an empty state once every card lives on the Home.
 *
 * It is a scroll view tied to the drawer gesture exactly like the website
 * lists, even though its content rarely scrolls: a page with no vertical
 * scroll view of its own leaves a vertical drag to the pager's recognizer on
 * iOS, and the drawer could then not be pulled down from it.
 */
export const HomeMoreFeatures = React.memo(function HomeMoreFeatures({
  drawerScrollableGesture,
  drawerScrollOffsetY,
  scrollableStatus,
  isActive,
}: HomeMoreFeaturesProps) {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const hasFeatures = useHasMoreHomeFeatures();
  const isEditing = useIsHomeFeatureEditing();

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
    <GestureDetector gesture={drawerScrollableGesture}>
      <Animated.ScrollView
        ref={scrollableRef}
        style={styles.page}
        contentContainerStyle={[
          styles.content,
          !hasFeatures && styles.emptyContent,
          isEditing && styles.editingContent,
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        animatedProps={animatedProps}>
        {hasFeatures ? (
          <>
            <HomeFeatureGrid place="more" />
            <View style={styles.swipeDownHint}>
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
          </>
        ) : (
          <>
            <RcImgMoreFeaturesEmpty width={163} height={126} />
            <Text style={styles.emptyText}>
              {t('page.home.moreFeatures.empty')}
            </Text>
          </>
        )}
      </Animated.ScrollView>
    </GestureDetector>
  );
});

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  page: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingTop: DRAWER_MORE_CONTENT_TOP,
    paddingBottom: 24,
    paddingHorizontal: ITEM_LAYOUT_PADDING_HORIZONTAL,
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  swipeDownHint: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
