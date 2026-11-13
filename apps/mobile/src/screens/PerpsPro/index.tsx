import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useHideTipsPopup, useIsTipsPopupVisible } from '@/hooks/useTipsPopup';
import {
  PerpsProHistorySheetHost,
  type PerpsProHistorySheetHostRef,
} from '@/screens/PerpsProHistory/PerpsProHistorySheet';
import { isPerpsProHistorySdkSupported } from '@/screens/PerpsProHistory/repository/perpsProHistoryRepository';
import type { PerpsRegionAlertLayout } from '@/screens/Perps/components/PerpsRegionAlert';
import { PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER } from '@/screens/PerpsShared/constants';
import React, { useCallback, useMemo, useRef } from 'react';
import type { Animated } from 'react-native';

import { PerpsProKeyboardAccessory } from './components/common/PerpsProKeyboardAccessory';
import { PerpsProScene } from './scene/PerpsProScene';
import { PerpsProSheetNavigationHost } from './components/common/PerpsProSheetNavigationGuard';
import { usePerpsProSheetNavigationRegistration } from './components/common/perpsProSheetNavigationRegistry';

const PerpsProPortfolioBreakdownNavigationRegistration = () => {
  const active = useIsTipsPopupVisible(PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER);
  const dismiss = useHideTipsPopup(PERPS_PORTFOLIO_BREAKDOWN_TIPS_OWNER);
  usePerpsProSheetNavigationRegistration({ active, dismiss });
  return null;
};

export type PerpsProScreenProps = {
  sceneActive?: boolean;
  sharedHeaderNativeScrollY?: Animated.Value;
  initialRegionAlertLayout?: PerpsRegionAlertLayout | null;
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
};

export const PerpsProScreen: React.FC<PerpsProScreenProps> = ({
  sceneActive = true,
  sharedHeaderNativeScrollY,
  initialRegionAlertLayout = null,
  isModeSwitching,
  onSwitchToSimple,
}) => {
  const historySheetRef = useRef<PerpsProHistorySheetHostRef>(null);
  const historyEnabled = useMemo(isPerpsProHistorySdkSupported, []);
  const openHistory = useCallback(
    (hasPendingFunding: boolean) => {
      if (!sceneActive || !historyEnabled) {
        return;
      }
      historySheetRef.current?.present(
        hasPendingFunding ? 'transaction' : 'orders',
      );
    },
    [historyEnabled, sceneActive],
  );

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      {sceneActive ? (
        <>
          <PerpsProSheetNavigationHost />
          <PerpsProPortfolioBreakdownNavigationRegistration />
        </>
      ) : null}
      <PerpsProKeyboardAccessory sceneActive={sceneActive} />
      <PerpsProScene
        sceneActive={sceneActive}
        sharedHeaderNativeScrollY={sharedHeaderNativeScrollY}
        historyEnabled={historyEnabled}
        initialRegionAlertLayout={initialRegionAlertLayout}
        isModeSwitching={isModeSwitching}
        onOpenHistory={openHistory}
        onSwitchToSimple={onSwitchToSimple}
      />
      {sceneActive && historyEnabled ? (
        <PerpsProHistorySheetHost ref={historySheetRef} />
      ) : null}
    </NormalScreenContainer2024>
  );
};
