import React from 'react';

import {
  useSetupWebviewWithServices,
  type SetupWebviewParams,
} from './useBackgroundBridge';
import {
  type BackgroundBridgeServiceInjectedProps,
  withBackgroundBridgeServices,
} from './backgroundBridgeServices';

type BackgroundBridgeSetup = ReturnType<typeof useSetupWebviewWithServices>;

type BackgroundBridgeBoundaryProps = SetupWebviewParams &
  BackgroundBridgeServiceInjectedProps & {
    children: (setup: BackgroundBridgeSetup) => React.ReactNode;
  };

function BackgroundBridgeBoundaryImpl({
  coreServices,
  children,
  ...setupParams
}: BackgroundBridgeBoundaryProps) {
  const setup = useSetupWebviewWithServices({
    ...setupParams,
    coreServices,
  });

  return <>{children(setup)}</>;
}

export const BackgroundBridgeBoundary = withBackgroundBridgeServices(
  BackgroundBridgeBoundaryImpl,
);
