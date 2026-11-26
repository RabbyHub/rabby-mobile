import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ITEM_GRID_GAP, ITEM_LAYOUT_PADDING_HORIZONTAL } from '@/constant/home';
import type { MultiHomeFeatTitle } from '@/constant/newStyle';
import { useWindowDimensions } from '@/core/dimensions';
import { triggerImpact } from '@/utils/common';
import {
  homeFeatureLayoutApi,
  useHomeMovableFeatures,
  useIsHomeFeatureEditing,
} from '../../hooks/homeFeatureLayout';
import {
  HOME_PINNED_FEATURES,
  isHomeFeatureMovable,
  type HomeFeaturePlace,
} from '../../utils/homeFeatureLayout';
import { HOME_FEATURE_CARD_HEIGHT } from './constants';
import { HomeFeatureCard } from './HomeFeatureCard';
import {
  useHomeFeatureItems,
  useHomeFeaturePress,
  type HomeFeatureItem,
} from './useHomeFeatureMenu';

const COLUMNS = 2;
/** The remaining cards gliding into their new slots. */
const SLOT_TIMING = { duration: 280, easing: Easing.out(Easing.cubic) };
/** The tapped card travelling towards the floor it is moving to. */
const LEAVE_TIMING = { duration: 240, easing: Easing.in(Easing.quad) };
const LEAVE_DISTANCE = 140;
const PIXEL_RATIO = PixelRatio.get();

/**
 * Cards are placed by transform, which skips the pixel rounding layout would
 * do, so a position has to be put on the device pixel grid here. Off the
 * grid, text re-rasterises on every animation step and shimmers.
 */
function snapToPixel(value: number) {
  'worklet';
  return Math.round(value * PIXEL_RATIO) / PIXEL_RATIO;
}

function getGridHeight(count: number) {
  const rows = Math.ceil(count / COLUMNS);
  return rows > 0
    ? rows * HOME_FEATURE_CARD_HEIGHT + (rows - 1) * ITEM_GRID_GAP
    : 0;
}

type SlotProps = {
  item: HomeFeatureItem;
  index: number;
  itemWidth: number;
  /** Distance between the left edges of two neighbouring columns. */
  columnStep: number;
  place: HomeFeaturePlace;
  editing: boolean;
  onPress: (key: MultiHomeFeatTitle) => void;
  onLongPress: () => void;
  onMove: (key: MultiHomeFeatTitle) => void;
};

/**
 * One card at one grid slot. Cards are placed by transform instead of by
 * flex-wrap, so a card changing slot is a UI-thread animation between two
 * known points: no layout pass has to land in the same frame as the
 * animation's first value, and the grid behaves the same on both platforms.
 */
const HomeFeatureGridSlot = React.memo(function HomeFeatureGridSlot({
  item,
  index,
  itemWidth,
  columnStep,
  place,
  editing,
  onPress,
  onLongPress,
  onMove,
}: SlotProps) {
  const targetX = (index % COLUMNS) * columnStep;
  const targetY =
    Math.floor(index / COLUMNS) * (HOME_FEATURE_CARD_HEIGHT + ITEM_GRID_GAP);
  const x = useSharedValue(targetX);
  const y = useSharedValue(targetY);
  const leaving = useSharedValue(0);
  const isLeavingRef = useRef(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const hasPlacedRef = useRef(false);

  useEffect(() => {
    // The first placement is the initial value above; only a later slot
    // change travels.
    if (!hasPlacedRef.current) {
      hasPlacedRef.current = true;
      return;
    }
    x.value = withTiming(targetX, SLOT_TIMING);
    y.value = withTiming(targetY, SLOT_TIMING);
  }, [targetX, targetY, x, y]);

  const commitMove = useCallback(() => {
    onMove(item.key);
  }, [item.key, onMove]);

  const handleMove = useCallback(() => {
    if (isLeavingRef.current) {
      return;
    }
    isLeavingRef.current = true;
    setIsLeaving(true);
    triggerImpact();
    // Commit even if the animation is cut short (the screen goes away): the
    // user asked for the move, the animation is only how it is shown.
    leaving.value = withTiming(1, LEAVE_TIMING, () => {
      runOnJS(commitMove)();
    });
  }, [commitMove, leaving]);

  // Down towards the second floor, up towards the first one.
  const leaveDirection = place === 'home' ? 1 : -1;
  const slotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(leaving.value, [0, 0.4, 1], [1, 1, 0]),
    transform: [
      { translateX: snapToPixel(x.value) },
      {
        translateY: snapToPixel(
          y.value + leaving.value * leaveDirection * LEAVE_DISTANCE,
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.slot,
        { width: itemWidth },
        isLeaving && styles.slotLeaving,
        slotStyle,
      ]}>
      <HomeFeatureCard
        item={item}
        editing={editing}
        movable={isHomeFeatureMovable(item.key)}
        moveDirection={place === 'home' ? 'down' : 'up'}
        onPress={onPress}
        onLongPress={onLongPress}
        onMove={handleMove}
      />
    </Animated.View>
  );
});

/**
 * The feature cards of one floor. It owns its own subscriptions (card order,
 * edit mode), so moving a card repaints the two grids and nothing around
 * them.
 */
export const HomeFeatureGrid = React.memo(function HomeFeatureGrid({
  place,
}: {
  place: HomeFeaturePlace;
}) {
  const movableKeys = useHomeMovableFeatures(place);
  const editing = useIsHomeFeatureEditing();
  const featureItems = useHomeFeatureItems();
  const handlePress = useHomeFeaturePress();
  const { width: windowWidth } = useWindowDimensions();
  // Both the card width and the column step sit on the pixel grid, and the
  // step is derived from the row width so the last column ends exactly at the
  // row's right edge.
  const rowWidth = windowWidth - ITEM_LAYOUT_PADDING_HORIZONTAL * 2;
  const itemWidth = snapToPixel(
    (rowWidth - ITEM_GRID_GAP * (COLUMNS - 1)) / COLUMNS,
  );
  const columnStep = snapToPixel((rowWidth - itemWidth) / (COLUMNS - 1));

  const items = useMemo(() => {
    const keys =
      place === 'home'
        ? [...HOME_PINNED_FEATURES, ...movableKeys]
        : movableKeys;
    return keys.reduce<HomeFeatureItem[]>((result, key) => {
      const item = featureItems.get(key);
      if (item) {
        result.push(item);
      }
      return result;
    }, []);
  }, [featureItems, movableKeys, place]);

  // Height is a layout prop, so this is the one place a layout pass rides an
  // animation. It only runs for the ~280ms of a card move, a discrete tap,
  // never along a gesture track; in exchange the content below the grid and
  // the scroll range settle smoothly instead of jumping a whole row.
  const height = getGridHeight(items.length);
  const animatedHeight = useSharedValue(height);
  const hasSizedRef = useRef(false);
  useEffect(() => {
    if (!hasSizedRef.current) {
      hasSizedRef.current = true;
      return;
    }
    animatedHeight.value = withTiming(height, SLOT_TIMING);
  }, [animatedHeight, height]);
  const heightStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  const handleLongPress = useCallback(() => {
    if (homeFeatureLayoutApi.isEditing()) {
      return;
    }
    triggerImpact();
    homeFeatureLayoutApi.startEditing();
  }, []);

  const handleMove = useCallback(
    (key: MultiHomeFeatTitle) => {
      homeFeatureLayoutApi.move(key, place === 'home' ? 'more' : 'home');
    },
    [place],
  );

  return (
    <Animated.View style={[styles.grid, heightStyle]}>
      {items.map((item, index) => (
        <HomeFeatureGridSlot
          key={item.key}
          item={item}
          index={index}
          itemWidth={itemWidth}
          columnStep={columnStep}
          place={place}
          editing={editing}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onMove={handleMove}
        />
      ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  grid: {
    width: '100%',
    position: 'relative',
  },
  slot: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: HOME_FEATURE_CARD_HEIGHT,
  },
  // The travelling card passes over its neighbours.
  slotLeaving: {
    zIndex: 1,
  },
});
