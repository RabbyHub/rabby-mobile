import React from 'react';

function isNewArchitectureEnabled() {
  return Boolean(
    (globalThis as any).nativeFabricUIManager ||
      (globalThis as any).RN$Bridgeless,
  );
}

export function BackgroundSecureBlurView() {
  if (isNewArchitectureEnabled()) {
    return null;
  }

  const { BackgroundSecureBlurViewLegacy } = require(
    './BackgroundSecureBlurViewLegacy',
  ) as typeof import('./BackgroundSecureBlurViewLegacy');

  return <BackgroundSecureBlurViewLegacy />;
}
