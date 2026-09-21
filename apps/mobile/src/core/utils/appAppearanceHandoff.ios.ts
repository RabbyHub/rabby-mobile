let isAppAppearanceReady = false;
let pendingApply: (() => void) | null = null;

export function applyAppAppearanceWhenReady(apply: () => void) {
  if (isAppAppearanceReady) {
    apply();
    return () => {};
  }

  pendingApply = apply;

  return () => {
    if (pendingApply === apply) {
      pendingApply = null;
    }
  };
}

export function releaseAppAppearanceHandoff() {
  if (isAppAppearanceReady) {
    return;
  }

  isAppAppearanceReady = true;
  const apply = pendingApply;
  pendingApply = null;
  apply?.();
}
