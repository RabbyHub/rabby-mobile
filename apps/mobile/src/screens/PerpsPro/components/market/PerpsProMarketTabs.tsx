import RcMarketTabFavorite from '@/assets2024/icons/perps/PerpsProMarketTabFavorite.svg';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Platform,
  PixelRatio,
  Pressable,
  Text as NativeText,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { ScrollView as GestureHandlerScrollView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import type { PerpsProMarketTab } from '../../model/market';
import {
  PerpsProTabIndicator,
  type PerpsProTabIndicatorLayout,
} from '../common/PerpsProTabIndicator';
import { getPerpsProFontStyle } from '../common/perpsProVisual';
import {
  getPerpsProTabDividerColor,
  getPerpsProTabIndicatorStyle,
  getPerpsProTabTextStyle,
  PERPS_PRO_TAB_TOKENS,
} from '../common/perpsProTabVisual';

type MarketTabItem = Readonly<{
  id: PerpsProMarketTab;
  label: string;
}>;

type MarketTabFrames = Partial<Record<PerpsProMarketTab, LayoutRectangle>>;

type MarketTabScrollPosition = Readonly<{
  tab: PerpsProMarketTab;
  x: number;
}>;

const MARKET_TAB_MEDIUM_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '500');
const MARKET_TAB_BOLD_FONT_STYLE = getPerpsProFontStyle(Platform.OS, '700');
// Figma 86609:237010: 42pt strip, 12pt top inset, 14pt gaps, 20pt insets.
const MARKET_TAB_GAP = 14;
const MARKET_TAB_PADDING = 20;
const MARKET_TAB_HEIGHT = 42;
const MARKET_TAB_PADDING_TOP = 12;
const MARKET_FAVORITES_ICON_WIDTH = 21;
const MARKET_FAVORITES_ICON_HEIGHT = 20;

type MarketTabLayout = Readonly<{
  frames: MarketTabFrames;
  contentWidth: number;
  viewportWidth: number;
}>;

type MarketTabMeasurements = {
  key: string;
  initialTabs: readonly MarketTabItem[];
  widths: Map<string, number>;
};

// Keep intrinsic measurements outside the keyed tab session. A prefix change
// can then mount at its final geometry instead of revealing offset zero first.
export const usePerpsProMarketTabLayout = ({
  candidates,
  fontScale,
  language,
  tabs: requestedTabs,
  viewportWidth,
}: {
  candidates: readonly MarketTabItem[];
  fontScale: number;
  language: string;
  tabs: readonly MarketTabItem[];
  viewportWidth: number;
}) => {
  const measurementKey = JSON.stringify([
    candidates,
    language,
    fontScale,
    viewportWidth,
    PixelRatio.get(),
    MARKET_TAB_BOLD_FONT_STYLE,
  ]);
  const [state, setState] = useState<{
    measurements: MarketTabMeasurements;
    widths: ReadonlyMap<string, number> | null;
  }>(() => ({
    measurements: {
      key: measurementKey,
      initialTabs: requestedTabs,
      widths: new Map(),
    },
    widths: null,
  }));
  let current = state;
  if (state.measurements.key !== measurementKey) {
    // Reset before rendering children with changed text/font/viewport inputs.
    // An effect would allow one render to combine new labels with old widths.
    current = {
      measurements: {
        key: measurementKey,
        initialTabs: requestedTabs,
        widths: new Map(),
      },
      widths: null,
    };
    setState(current);
  }
  const { measurements, widths } = current;
  const onMeasure = useCallback(
    (tab: PerpsProMarketTab, width: number) => {
      if (
        !Number.isFinite(width) ||
        width <= 0 ||
        !candidates.some(candidate => candidate.id === tab) ||
        measurements.widths.get(tab) === width
      ) {
        return;
      }
      measurements.widths.set(tab, width);
      if (
        candidates.some(candidate => !measurements.widths.has(candidate.id))
      ) {
        return;
      }
      const nextWidths = new Map(measurements.widths);
      // Old native layout callbacks cannot publish into a newer locale/session.
      setState(previous =>
        previous.measurements === measurements
          ? { measurements, widths: nextWidths }
          : previous,
      );
    },
    [candidates, measurements],
  );
  // Until all measurements arrive, keep one coherent tab sequence for the
  // labels, pager and handlers. Favorite data itself is updated immediately.
  const tabs = widths ? requestedTabs : measurements.initialTabs;
  const initialLayout = useMemo<MarketTabLayout | undefined>(() => {
    if (!widths) {
      return undefined;
    }
    const frames: MarketTabFrames = {};
    let x = MARKET_TAB_PADDING;
    for (const tab of tabs) {
      const width = widths.get(tab.id)!;
      frames[tab.id] = {
        height: MARKET_TAB_HEIGHT,
        width,
        x: PixelRatio.roundToNearestPixel(x),
        y: 0,
      };
      x += width + MARKET_TAB_GAP;
    }
    return {
      contentWidth: Math.max(
        viewportWidth,
        PixelRatio.roundToNearestPixel(x - MARKET_TAB_GAP + MARKET_TAB_PADDING),
      ),
      frames,
      viewportWidth,
    };
  }, [tabs, viewportWidth, widths]);

  return { initialLayout, measurementKey, onMeasure, tabs };
};

const PerpsProMarketTabLabel: React.FC<{
  activeColor: string;
  index: number;
  inactiveColor: string;
  indicatorPosition: SharedValue<number>;
  label: string;
  style: StyleProp<TextStyle>;
  tabCount: number;
}> = React.memo(
  ({
    activeColor,
    index,
    inactiveColor,
    indicatorPosition,
    label,
    style,
    tabCount,
  }) => {
    const animatedStyle = useAnimatedStyle(() => {
      // The label and underline intentionally share one UI-thread visual
      // position; activeTab remains the business/accessibility selection.
      const maximumIndex = Math.max(0, tabCount - 1);
      const rawPosition = Number.isFinite(indicatorPosition.value)
        ? indicatorPosition.value
        : 0;
      const visualIndex = Math.round(
        Math.max(0, Math.min(maximumIndex, rawPosition)),
      );
      const active = visualIndex === index;

      return {
        color: active ? activeColor : inactiveColor,
        fontFamily: active
          ? MARKET_TAB_BOLD_FONT_STYLE.fontFamily
          : MARKET_TAB_MEDIUM_FONT_STYLE.fontFamily,
        fontWeight: active
          ? MARKET_TAB_BOLD_FONT_STYLE.fontWeight
          : MARKET_TAB_MEDIUM_FONT_STYLE.fontWeight,
      };
    }, [activeColor, inactiveColor, index, indicatorPosition, tabCount]);

    return (
      <View style={labelStyles.container}>
        <NativeText
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          numberOfLines={1}
          style={[style, labelStyles.measureText]}>
          {label}
        </NativeText>
        <Animated.Text
          numberOfLines={1}
          style={[style, labelStyles.visibleText, animatedStyle]}>
          {label}
        </Animated.Text>
      </View>
    );
  },
);

PerpsProMarketTabLabel.displayName = 'PerpsProMarketTabLabel';

// Figma 86609:237011 replaces the Favorites label with a fixed 21x20 star.
const PerpsProMarketFavoritesTabIcon: React.FC<{
  activeColor: string;
  inactiveColor: string;
  index: number;
  indicatorPosition: SharedValue<number>;
  tabCount: number;
}> = React.memo(
  ({ activeColor, inactiveColor, index, indicatorPosition, tabCount }) => {
    const activeAnimatedStyle = useAnimatedStyle(() => {
      const maximumIndex = Math.max(0, tabCount - 1);
      const rawPosition = Number.isFinite(indicatorPosition.value)
        ? indicatorPosition.value
        : 0;
      const visualIndex = Math.round(
        Math.max(0, Math.min(maximumIndex, rawPosition)),
      );
      return { opacity: visualIndex === index ? 1 : 0 };
    }, [index, indicatorPosition, tabCount]);

    return (
      <View style={favoritesIconStyles.container}>
        <RcMarketTabFavorite
          color={inactiveColor}
          height={FAVORITES_STAR_HEIGHT}
          width={FAVORITES_STAR_WIDTH}
        />
        <Animated.View
          style={[favoritesIconStyles.activeLayer, activeAnimatedStyle]}>
          <RcMarketTabFavorite
            color={activeColor}
            height={FAVORITES_STAR_HEIGHT}
            width={FAVORITES_STAR_WIDTH}
          />
        </Animated.View>
      </View>
    );
  },
);

PerpsProMarketFavoritesTabIcon.displayName = 'PerpsProMarketFavoritesTabIcon';

const FAVORITES_STAR_WIDTH = 17.83;
const FAVORITES_STAR_HEIGHT = 17.12;

const favoritesIconStyles = {
  container: {
    alignItems: 'center' as const,
    height: MARKET_FAVORITES_ICON_HEIGHT,
    justifyContent: 'center' as const,
    width: MARKET_FAVORITES_ICON_WIDTH,
  },
  activeLayer: {
    alignItems: 'center' as const,
    bottom: 0,
    justifyContent: 'center' as const,
    left: 0,
    position: 'absolute' as const,
    right: 0,
    top: 0,
  },
};

const labelStyles = {
  container: {
    position: 'relative' as const,
  },
  measureText: {
    ...MARKET_TAB_BOLD_FONT_STYLE,
    opacity: 0,
  },
  visibleText: {
    left: 0,
    position: 'absolute' as const,
    right: 0,
    textAlign: 'center' as const,
    top: 0,
  },
};

export const getPerpsProMarketTabScrollOffset = ({
  contentWidth,
  frame,
  viewportWidth,
}: {
  contentWidth: number;
  frame: LayoutRectangle;
  viewportWidth: number;
}) => {
  if (viewportWidth <= 0 || contentWidth <= viewportWidth) {
    return null;
  }
  const maximumOffset = contentWidth - viewportWidth;
  const centeredOffset = frame.x - (viewportWidth - frame.width) / 2;
  return Math.max(0, Math.min(maximumOffset, centeredOffset));
};

export const updatePerpsProMarketTabFrame = (
  tab: PerpsProMarketTab,
  event: LayoutChangeEvent,
  setTabFrames: React.Dispatch<React.SetStateAction<MarketTabFrames>>,
) => {
  const { x, y, width, height } = event.nativeEvent.layout;
  const frame: LayoutRectangle = { x, y, width, height };

  setTabFrames(previous => {
    const current = previous[tab];
    if (
      current?.x === x &&
      current.y === y &&
      current.width === width &&
      current.height === height
    ) {
      return previous;
    }
    return {
      ...previous,
      [tab]: frame,
    };
  });
};

export const PerpsProMarketTabs: React.FC<{
  activeTab: PerpsProMarketTab;
  indicatorPosition: SharedValue<number>;
  initialLayout?: MarketTabLayout;
  measureTab?: MarketTabItem;
  onChange: (tab: PerpsProMarketTab) => void;
  onMeasure?: (tab: PerpsProMarketTab, width: number) => void;
  tabs: readonly MarketTabItem[];
}> = React.memo(props => {
  const {
    activeTab,
    indicatorPosition,
    initialLayout,
    measureTab,
    onChange,
    onMeasure,
    tabs,
  } = props;
  const { colors2024, styles } = useTheme2024({ getStyle });
  const scrollRef = useRef<GestureHandlerScrollView>(null);
  const [initialGeometry] = useState(() => {
    const frame = initialLayout?.frames[activeTab];
    return {
      layout: initialLayout,
      offset: {
        x:
          initialLayout && frame
            ? getPerpsProMarketTabScrollOffset({ ...initialLayout, frame }) ?? 0
            : 0,
        y: 0,
      },
    };
  });
  const lastScrollPositionRef = useRef<MarketTabScrollPosition | null>(
    initialGeometry.layout
      ? { tab: activeTab, x: initialGeometry.offset.x }
      : null,
  );
  const [tabFrames, setTabFrames] = useState<MarketTabFrames>(
    initialGeometry.layout?.frames ?? {},
  );
  const [viewportWidth, setViewportWidth] = useState(
    initialGeometry.layout?.viewportWidth ?? 0,
  );
  const [contentWidth, setContentWidth] = useState(
    initialGeometry.layout?.contentWidth ?? 0,
  );
  const activeFrame = tabFrames[activeTab];
  const indicatorLayouts = useMemo<
    readonly PerpsProTabIndicatorLayout[]
  >(() => {
    const layouts: PerpsProTabIndicatorLayout[] = [];
    for (const tab of tabs) {
      const frame = tabFrames[tab.id];
      if (!frame) {
        return [];
      }
      layouts.push({
        width: frame.width + PERPS_PRO_TAB_TOKENS.indicatorCapInset * 2,
        x: frame.x - PERPS_PRO_TAB_TOKENS.indicatorCapInset,
      });
    }
    return layouts;
  }, [tabFrames, tabs]);

  const scrollActiveTabIntoView = useCallback(() => {
    if (!activeFrame) {
      return;
    }
    const x = getPerpsProMarketTabScrollOffset({
      contentWidth,
      frame: activeFrame,
      viewportWidth,
    });
    if (x === null) {
      return;
    }
    const lastPosition = lastScrollPositionRef.current;
    if (lastPosition?.x === x) {
      lastScrollPositionRef.current = { tab: activeTab, x };
      return;
    }
    if (!scrollRef.current) {
      return;
    }
    // Search mode unmounts this strip. Its first valid geometry is restored
    // in place; only a later controlled tab change should visibly animate.
    scrollRef.current.scrollTo({
      animated: lastPosition !== null && lastPosition.tab !== activeTab,
      x,
    });
    lastScrollPositionRef.current = { tab: activeTab, x };
  }, [activeFrame, activeTab, contentWidth, viewportWidth]);

  useLayoutEffect(() => {
    scrollActiveTabIntoView();
  }, [scrollActiveTabIntoView]);

  return (
    <View style={styles.container} testID="perps-pro-market-tabs-container">
      <View
        pointerEvents="none"
        style={styles.divider}
        testID="perps-pro-market-tabs-divider"
      />
      <GestureHandlerScrollView
        accessibilityRole="tablist"
        contentOffset={initialGeometry.offset}
        contentContainerStyle={styles.content}
        horizontal
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        onContentSizeChange={width => setContentWidth(width)}
        onLayout={event => setViewportWidth(event.nativeEvent.layout.width)}
        ref={scrollRef}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        testID="perps-pro-market-tabs">
        {tabs.map((tab, index) => {
          const active = tab.id === activeTab;
          return (
            <Pressable
              key={tab.id}
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onLayout={event => {
                updatePerpsProMarketTabFrame(tab.id, event, setTabFrames);
                onMeasure?.(tab.id, event.nativeEvent.layout.width);
              }}
              onPress={() => onChange(tab.id)}
              style={styles.tab}
              testID={`perps-pro-market-tab-${tab.id}`}>
              {tab.id === 'favorites' ? (
                <PerpsProMarketFavoritesTabIcon
                  activeColor={colors2024['neutral-title-1']}
                  inactiveColor={colors2024['neutral-info']}
                  index={index}
                  indicatorPosition={indicatorPosition}
                  tabCount={tabs.length}
                />
              ) : (
                <PerpsProMarketTabLabel
                  activeColor={colors2024['neutral-title-1']}
                  index={index}
                  inactiveColor={colors2024['neutral-secondary']}
                  indicatorPosition={indicatorPosition}
                  label={tab.label}
                  style={styles.text}
                  tabCount={tabs.length}
                />
              )}
            </Pressable>
          );
        })}
        <PerpsProTabIndicator
          layouts={indicatorLayouts}
          position={indicatorPosition}
          style={styles.indicator}
          testID="perps-pro-market-tab-indicator"
        />
        {measureTab ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={styles.extraMeasure}>
            {measureTab.id === 'favorites' ? (
              <View
                onLayout={event =>
                  onMeasure?.(measureTab.id, event.nativeEvent.layout.width)
                }
                style={favoritesIconStyles.container}
                testID="perps-pro-market-tab-extra-measure"
              />
            ) : (
              <NativeText
                numberOfLines={1}
                onLayout={event =>
                  onMeasure?.(measureTab.id, event.nativeEvent.layout.width)
                }
                style={[styles.text, labelStyles.measureText]}
                testID="perps-pro-market-tab-extra-measure">
                {measureTab.label}
              </NativeText>
            )}
          </View>
        ) : null}
      </GestureHandlerScrollView>
    </View>
  );
});

PerpsProMarketTabs.displayName = 'PerpsProMarketTabs';

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    height: MARKET_TAB_HEIGHT,
    marginTop: 14,
  },
  // A ScrollView border clips the underline to its padding box on Android.
  // Paint the divider behind it without reducing the scroll viewport.
  divider: {
    backgroundColor: getPerpsProTabDividerColor(colors2024),
    bottom: 0,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  scroll: {
    flexGrow: 0,
    height: MARKET_TAB_HEIGHT,
  },
  content: {
    gap: MARKET_TAB_GAP,
    paddingHorizontal: MARKET_TAB_PADDING,
    position: 'relative',
    height: MARKET_TAB_HEIGHT,
  },
  extraMeasure: {
    flexDirection: 'row',
    position: 'absolute',
    opacity: 0,
  },
  tab: {
    alignItems: 'center',
    height: MARKET_TAB_HEIGHT,
    paddingHorizontal: 0,
    paddingTop: MARKET_TAB_PADDING_TOP,
  },
  text: getPerpsProTabTextStyle(colors2024),
  indicator: getPerpsProTabIndicatorStyle(),
}));
