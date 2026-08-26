import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { isPerpsProHistorySdkSupported } from '@/screens/PerpsProHistory/repository/perpsProHistoryRepository';
import type { PerpsRegionAlertLayout } from '@/screens/Perps/components/PerpsRegionAlert';
import React, { useCallback, useMemo } from 'react';

import { PerpsProScene } from './scene/PerpsProScene';

export type PerpsProScreenProps = {
  initialRegionAlertLayout?: PerpsRegionAlertLayout | null;
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
};

export const PerpsProScreen: React.FC<PerpsProScreenProps> = ({
  initialRegionAlertLayout = null,
  isModeSwitching,
  onSwitchToSimple,
}) => {
  const navigation = useRabbyAppNavigation();
  const historyEnabled = useMemo(isPerpsProHistorySdkSupported, []);
  const openHistory = useCallback(
    (hasPendingFunding: boolean) => {
      if (!historyEnabled) {
        return;
      }
      navigation.push(
        RootNames.StackTransaction,
        hasPendingFunding
          ? {
              params: { initialTab: 'transaction' },
              screen: RootNames.PerpsProHistory,
            }
          : { screen: RootNames.PerpsProHistory },
      );
    },
    [historyEnabled, navigation],
  );

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <PerpsProScene
        historyEnabled={historyEnabled}
        initialRegionAlertLayout={initialRegionAlertLayout}
        isModeSwitching={isModeSwitching}
        onOpenHistory={openHistory}
        onSwitchToSimple={onSwitchToSimple}
      />
    </NormalScreenContainer2024>
  );
};
