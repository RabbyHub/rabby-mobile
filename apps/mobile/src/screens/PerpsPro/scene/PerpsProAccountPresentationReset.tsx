import { useCollapsibleScene } from '@rabby-wallet/rn-collapsible-scene-view';
import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { Animated } from 'react-native';
import {
  cancelAnimation,
  runOnUI,
  type SharedValue,
} from 'react-native-reanimated';

import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { PERPS_PRO_INFO_TABS } from '../components/info/perpsProInfoTabOrder';
import {
  PERPS_PRO_INFO_TOUCH_INTENT,
  type PerpsProInfoScrollBridgeController,
} from '../components/info/usePerpsProInfoScrollBridge';

type Props = {
  accountIdentity: string;
  activeTab: PerpsProInfoTab | null;
  bridge: PerpsProInfoScrollBridgeController;
  indicatorPosition: SharedValue<number>;
  listContentHeight: RefObject<number>;
  nativeScrollY: Animated.Value;
};

/** The account-keyed native list starts at zero. Its presentation values live
 * above that key, so reset them at the same account boundary without issuing
 * a scroll command or remounting the trade owner. Ordinary tab changes retain
 * the current vertical position.
 */
export function PerpsProAccountPresentationReset({
  accountIdentity,
  activeTab,
  bridge,
  indicatorPosition,
  listContentHeight,
  nativeScrollY,
}: Props) {
  const { activeTabIndex, reportScroll, scrollY } = useCollapsibleScene();
  const previousIdentity = useRef(accountIdentity);

  useLayoutEffect(() => {
    if (previousIdentity.current === accountIdentity) {
      return;
    }
    previousIdentity.current = accountIdentity;

    nativeScrollY.setValue(0);
    listContentHeight.current = 0;
    // The provider owns saved offsets independently of controller.scrollY.
    PERPS_PRO_INFO_TABS.forEach(tab => reportScroll(tab, 0));
    const index = Math.max(
      0,
      PERPS_PRO_INFO_TABS.indexOf(activeTab ?? 'positions'),
    );
    runOnUI((nextIndex: number) => {
      'worklet';
      scrollY.value = 0;
      activeTabIndex.value = nextIndex;
      bridge.activeIndex.value = nextIndex;
      bridge.epoch.value += 1;
      bridge.touchSessionId.value += 1;
      bridge.horizontalTouchSessionId.value = 0;
      bridge.touchIntent.value = PERPS_PRO_INFO_TOUCH_INTENT.idle;
      bridge.pageGestureActive.value = false;
      bridge.targets.forEach(target => {
        target.offset.value = 0;
        target.maxOffset.value = 0;
      });
      cancelAnimation(indicatorPosition);
      indicatorPosition.value = nextIndex;
    })(index);
  }, [
    accountIdentity,
    activeTab,
    activeTabIndex,
    bridge,
    indicatorPosition,
    listContentHeight,
    nativeScrollY,
    reportScroll,
    scrollY,
  ]);

  return null;
}
