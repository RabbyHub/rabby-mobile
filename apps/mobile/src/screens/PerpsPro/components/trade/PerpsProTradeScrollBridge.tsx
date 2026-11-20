import React from 'react';
import { Platform, ScrollView } from 'react-native';

import {
  PerpsProOverlayScrollBridge,
  type PerpsProOverlayScrollBridgeProps,
} from '../common/PerpsProOverlayScrollBridge';

type PerpsProTradeScrollBridgeProps = Omit<
  PerpsProOverlayScrollBridgeProps,
  'testID'
>;

const PerpsProAndroidTradeScrollBridge: React.FC<
  PerpsProTradeScrollBridgeProps
> = ({ children, height }) => (
  <ScrollView
    keyboardShouldPersistTaps="handled"
    removeClippedSubviews={false}
    scrollEnabled={false}
    showsVerticalScrollIndicator={false}
    style={{ height }}
    testID="perps-pro-trade-scroll-bridge">
    {children}
  </ScrollView>
);

export const PerpsProTradeScrollBridge: React.FC<
  PerpsProTradeScrollBridgeProps
> = props =>
  Platform.OS === 'android' ? (
    <PerpsProAndroidTradeScrollBridge {...props} />
  ) : (
    <PerpsProOverlayScrollBridge
      {...props}
      testID="perps-pro-trade-scroll-bridge"
    />
  );
