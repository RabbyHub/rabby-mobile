import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import React, { useLayoutEffect } from 'react';

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <NormalScreenContainer2024 noHeader type="bg1">
      <PerpsProScene
        isModeSwitching={isModeSwitching}
        onSwitchToSimple={onSwitchToSimple}
      />
    </NormalScreenContainer2024>
  );
};
