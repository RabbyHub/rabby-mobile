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
  measure,
  runOnJS,
  runOnUI,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedRef,
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
  getHomeFeatureLeaveOffset,
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
/**
 * The design's timing for a card move. The tapped card first travels off the
 * screen towards the floor it is moving to, then the remaining cards close
 * the gap; each takes 300ms on cubic-bezier(0.42, 0, 0.58, 1).
 */
const MOVE_TIMING = {
  duration: 300,
  easing: Easing.bezier(0.42, 0, 0.58, 1),
};
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
  /** The grid the slot is placed in, to find the card on the screen. */
  gridRef: AnimatedRef<Animated.View>;
  windowHeight: number;
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
  gridRef,
  windowHeight,
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
  const leaveOffset = useSharedValue(0);
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
    x.value = withTiming(targetX, MOVE_TIMING);
    y.value = withTiming(targetY, MOVE_TIMING);
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
    runOnUI(() => {
      'worklet';
      // The slot's own transform lives on the UI thread, so the card is
      // found from the grid's frame plus its current offset in the grid.
      const gridFrame = measure(gridRef);
      const cardTop = gridFrame ? gridFrame.pageY + y.value : null;
      // Commit even if the animation is cut short (the screen goes away):
      // the user asked for the move, the animation is only how it is shown.
      leaveOffset.value = withTiming(
        getHomeFeatureLeaveOffset(
          place,
          cardTop,
          windowHeight,
          HOME_FEATURE_CARD_HEIGHT,
        ),
        MOVE_TIMING,
        () => {
          runOnJS(commitMove)();
        },
      );
    })();
  }, [commitMove, gridRef, leaveOffset, place, windowHeight, y]);

  // It stays opaque all the way: it leaves by going off the screen, down
  // under the edit footer from Home, up under the title row from the second
  // floor.
  const slotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: snapToPixel(x.value) },
      { translateY: snapToPixel(y.value + leaveOffset.value) },
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const gridRef = useAnimatedRef<Animated.View>();
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
  // animation. It only runs for the 300ms of a card move, a discrete tap,
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
    animatedHeight.value = withTiming(height, MOVE_TIMING);
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
    <Animated.View ref={gridRef} style={[styles.grid, heightStyle]}>
      {items.map((item, index) => (
        <HomeFeatureGridSlot
          key={item.key}
          item={item}
          index={index}
          itemWidth={itemWidth}
          columnStep={columnStep}
          gridRef={gridRef}
          windowHeight={windowHeight}
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
  // Above what follows it on the floor: a card leaving Home passes over the
  // content under the grid on its way off the screen.
  grid: {
    width: '100%',
    position: 'relative',
    zIndex: 1,
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
