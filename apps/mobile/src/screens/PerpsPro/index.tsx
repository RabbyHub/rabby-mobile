import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RootNames } from '@/constant/layout';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { isPerpsProHistorySdkSupported } from '@/screens/PerpsProHistory/repository/perpsProHistoryRepository';
import React, { useCallback, useMemo } from 'react';

import { PerpsProScene } from './scene/PerpsProScene';

export type PerpsProScreenProps = {
  isModeSwitching: boolean;
  onSwitchToSimple: () => void;
};

export const PerpsProScreen: React.FC<PerpsProScreenProps> = ({
  isModeSwitching,
  onSwitchToSimple,
}) => {
  const navigation = useRabbyAppNavigation();
  const historyEnabled = useMemo(isPerpsProHistorySdkSupported, []);
  const openHistory = useCallback(() => {
    if (!historyEnabled) {
      return;
    }
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.PerpsProHistory,
    });
  }, [historyEnabled, navigation]);

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <PerpsProScene
        historyEnabled={historyEnabled}
        isModeSwitching={isModeSwitching}
        onOpenHistory={openHistory}
        onSwitchToSimple={onSwitchToSimple}
      />
    </NormalScreenContainer2024>
  );
};
