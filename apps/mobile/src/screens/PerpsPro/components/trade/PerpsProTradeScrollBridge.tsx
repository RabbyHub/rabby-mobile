import React, { useMemo, type PropsWithChildren } from 'react';
import { Platform, ScrollView, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  scrollTo,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import {
  getPerpsProInfoBridgeOffset,
  scrollPerpsProInfoBridgeTarget,
  type PerpsProInfoScrollBridgeController,
} from '../info/usePerpsProInfoScrollBridge';
import { usePerpsProAndroidTradeScrollDriver } from './usePerpsProAndroidTradeScrollDriver';

const PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR = 100_000;
const PERPS_PRO_TRADE_SCROLL_BRIDGE_SETTLE_VELOCITY = 0.01;

type PerpsProTradeScrollBridgeProps = PropsWithChildren<{
  controller: PerpsProInfoScrollBridgeController;
  enabled?: boolean;
  height: number;
}>;

const PerpsProNativeTradeScrollBridge: React.FC<
  PerpsProTradeScrollBridgeProps
> = ({ children, controller, enabled = true, height }) => {
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const proxyOffset = useSharedValue(PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR);
  const lastProxyOffset = useSharedValue(PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR);
  const targetOffset = useSharedValue(0);
  const sessionEpoch = useSharedValue(-1);
  const sessionActive = useSharedValue(false);

  const settle = () => {
    'worklet';
    sessionActive.value = false;
    proxyOffset.value = PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR;
    lastProxyOffset.value = PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR;
    scrollTo(scrollRef, 0, PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR, false);
  };

  const scrollHandler = useAnimatedScrollHandler({
    onBeginDrag: event => {
      if (controller.pageGestureActive.value) {
        sessionActive.value = false;
        return;
      }
      const index = controller.activeIndex.value;
      const target = controller.targets[index];
      const offset = event.contentOffset.y;
      proxyOffset.value = offset;
      lastProxyOffset.value = offset;
      if (!target) {
        sessionActive.value = false;
        return;
      }
      targetOffset.value = Math.min(
        Math.max(target.offset.value, 0),
        target.maxOffset.value,
      );
      sessionEpoch.value = controller.epoch.value;
      sessionActive.value = true;
    },
    onEndDrag: event => {
      const velocity = event.velocity?.y ?? 0;
      if (Math.abs(velocity) <= PERPS_PRO_TRADE_SCROLL_BRIDGE_SETTLE_VELOCITY) {
        settle();
      }
    },
    onMomentumEnd: () => {
      settle();
    },
    onScroll: event => {
      const offset = event.contentOffset.y;
      proxyOffset.value = offset;
      if (!sessionActive.value) {
        lastProxyOffset.value = offset;
        return;
      }
      if (sessionEpoch.value !== controller.epoch.value) {
        sessionActive.value = false;
        lastProxyOffset.value = offset;
        return;
      }

      const index = controller.activeIndex.value;
      const target = controller.targets[index];
      if (!target) {
        sessionActive.value = false;
        lastProxyOffset.value = offset;
        return;
      }
      const delta = offset - lastProxyOffset.value;
      lastProxyOffset.value = offset;
      const nextOffset = getPerpsProInfoBridgeOffset({
        delta,
        maxOffset: target.maxOffset.value,
        offset: targetOffset.value,
      });
      if (nextOffset === targetOffset.value) {
        return;
      }
      targetOffset.value = nextOffset;
      scrollPerpsProInfoBridgeTarget(controller, index, nextOffset);
    },
  });

  const tradeStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: proxyOffset.value - PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR,
      },
    ],
  }));
  const contentContainerStyle = useMemo<ViewStyle>(
    () => ({
      minHeight: PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR * 2 + height,
      paddingTop: PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR,
    }),
    [height],
  );

  return (
    <Reanimated.ScrollView
      contentContainerStyle={contentContainerStyle}
      contentOffset={{ x: 0, y: PERPS_PRO_TRADE_SCROLL_BRIDGE_ANCHOR }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      onScroll={scrollHandler}
      ref={scrollRef}
      removeClippedSubviews={false}
      scrollEnabled={enabled}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      style={{ height }}
      testID="perps-pro-trade-scroll-bridge">
      <Reanimated.View style={tradeStyle}>{children}</Reanimated.View>
    </Reanimated.ScrollView>
  );
};

const PerpsProAndroidTradeScrollBridge: React.FC<
  PerpsProTradeScrollBridgeProps
> = ({ children, controller, enabled = true, height }) => {
  const gesture = usePerpsProAndroidTradeScrollDriver({
    controller,
    enabled,
  });

  return (
    <GestureDetector gesture={gesture}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        style={{ height }}
        testID="perps-pro-trade-scroll-bridge">
        {children}
      </ScrollView>
    </GestureDetector>
  );
};

export const PerpsProTradeScrollBridge: React.FC<
  PerpsProTradeScrollBridgeProps
> = props =>
  Platform.OS === 'android' ? (
    <PerpsProAndroidTradeScrollBridge {...props} />
  ) : (
    <PerpsProNativeTradeScrollBridge {...props} />
  );
