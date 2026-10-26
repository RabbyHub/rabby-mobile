import React from 'react';

import { useToggleShowStartupRuntimePanel } from './startupRuntimePanelSetting';

const LazyFloatingStartupRuntimePanel = React.lazy(() =>
  import('./FloatingStartupRuntimePanel').then(module => ({
    default: module.FloatingStartupRuntimePanel,
  })),
);

export function StartupRuntimePanelHost() {
  const { showStartupRuntimePanel } = useToggleShowStartupRuntimePanel();

  if (!showStartupRuntimePanel) {
    return null;
  }

  return (
    <React.Suspense fallback={null}>
      <LazyFloatingStartupRuntimePanel />
    </React.Suspense>
  );
}
