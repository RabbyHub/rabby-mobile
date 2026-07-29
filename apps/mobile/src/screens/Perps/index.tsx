import { useEnsurePerpsRuntime } from '@/hooks/perps/runtime/useEnsurePerpsRuntime';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import React, { useCallback, useLayoutEffect } from 'react';

import { PerpsProScreen } from '../PerpsPro';
import { usePerpsViewMode } from './hooks/usePerpsViewMode';
import { PerpsSimpleScreen } from './PerpsSimpleScreen';

export const PerpsOriginScreen = () => {
  useEnsurePerpsRuntime();

  const navigation = useRabbyAppNavigation();
  const { hydrated, savingMode, setViewMode, viewMode } = usePerpsViewMode();

  useLayoutEffect(() => {
    if (!hydrated) {
      navigation.setOptions({
        headerShown: false,
      });
    }
  }, [hydrated, navigation]);

  const switchToPro = useCallback(() => {
    setViewMode('pro');
  }, [setViewMode]);

  const switchToSimple = useCallback(() => {
    setViewMode('simple');
  }, [setViewMode]);

  if (!hydrated) {
    return null;
  }

  if (viewMode === 'pro') {
    return (
      <PerpsProScreen
        isModeSwitching={savingMode !== null}
        onSwitchToSimple={switchToSimple}
      />
    );
  }

  return (
    <PerpsSimpleScreen
      isModeSwitching={savingMode !== null}
      onSwitchToPro={switchToPro}
    />
  );
};
