import React from 'react';

import { BackgroundSecureBlurViewLegacy } from './BlurViews';

type NewArchitectureGlobals = typeof globalThis & {
  nativeFabricUIManager?: unknown;
  RN$Bridgeless?: unknown;
};

function isNewArchitectureEnabled() {
  const globals = globalThis as NewArchitectureGlobals;
  return Boolean(globals.nativeFabricUIManager || globals.RN$Bridgeless);
}

/**
 * The app-switcher overlay is backed by the legacy BlurView implementation.
 * Fabric cannot render that overlay safely yet, so preserve the old-arch
 * behavior while keeping it out of the new-architecture startup tree.
 */
export function BackgroundSecureBlurView() {
  if (isNewArchitectureEnabled()) {
    return null;
  }

  return <BackgroundSecureBlurViewLegacy />;
}
