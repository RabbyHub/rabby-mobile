export function getHomeTabIndicatorWidth(winWidth: number) {
  'worklet';
  const indicatorWidth = (winWidth - 52) / 2;

  return indicatorWidth;
}
