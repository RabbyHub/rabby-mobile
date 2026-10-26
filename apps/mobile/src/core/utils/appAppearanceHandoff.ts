export function applyAppAppearanceWhenReady(apply: () => void) {
  apply();
  return () => {};
}

export function releaseAppAppearanceHandoff() {}
