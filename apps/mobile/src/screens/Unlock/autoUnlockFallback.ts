type AutoUnlockFallbackOptions = {
  delayMs: number;
  shouldFallback: () => boolean;
  onFallback: () => void;
};

export function scheduleAutoUnlockFallback({
  delayMs,
  shouldFallback,
  onFallback,
}: AutoUnlockFallbackOptions) {
  const timeoutId = setTimeout(() => {
    if (shouldFallback()) {
      onFallback();
    }
  }, delayMs);

  return () => clearTimeout(timeoutId);
}
