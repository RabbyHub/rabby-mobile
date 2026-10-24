/**
 * A shared group header lives beside the native horizontal viewport, not in
 * its scrolling content. Within the group it has no horizontal displacement;
 * only entering/leaving the group moves it once with the adjacent page.
 */
export function getLinkedHeaderTranslateX(
  progress: number,
  first: number,
  last: number,
  width: number,
): number {
  'worklet';
  if (progress < first) {
    return (first - progress) * width;
  }
  if (progress > last) {
    return (last - progress) * width;
  }
  return 0;
}

/** Build a native Animated interpolation without duplicate range points. */
export function getLinkedHeaderNativeInterpolation(
  first: number,
  last: number,
  width: number,
): {
  inputRange: number[];
  outputRange: number[];
  extrapolate: 'extend';
} | null {
  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }
  const pages =
    first === last
      ? [first - 1, first, first + 1]
      : [first - 1, first, last, last + 1];
  return {
    inputRange: pages.map(page => page * width),
    outputRange: pages.map(page =>
      getLinkedHeaderTranslateX(page, first, last, width),
    ),
    extrapolate: 'extend',
  };
}
