import { useCallback, useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { ViewToken } from 'react-native';
import { preloadSimpleChart } from './preloadSimpleChart';

/** Only the active search tab's two leading visible candidates; no row subscriptions. */
export function useSimpleChartPreload(activeTab = true) {
  const focused = useIsFocused();
  const enabled = focused && activeTab;
  const live = useRef(false);
  const coins = useRef<string[]>([]);
  const warm = useCallback(() => {
    if (!live.current) return;
    for (const coin of coins.current)
      preloadSimpleChart(coin, undefined, () => live.current);
  }, []);
  useEffect(() => {
    live.current = enabled;
    warm();
    return () => {
      live.current = false;
    };
  }, [enabled, warm]);
  return useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      coins.current = viewableItems
        .filter(item => item.isViewable)
        .slice(0, 2)
        .map(item => item.item.name as string);
      warm();
    },
    [warm],
  );
}
