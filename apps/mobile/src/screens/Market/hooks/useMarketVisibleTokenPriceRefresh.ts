import { openapi } from '@/core/request';
import { useIsFocused } from '@react-navigation/native';
import { useCallback, useEffect, useRef } from 'react';
import { useSetAtom } from 'jotai';

import { marketRealtimePriceAtom } from '../atom';

export const useMarketVisibleTokenPriceRefresh = (activeTab: string) => {
  const setMarketRealtimePrice = useSetAtom(marketRealtimePriceAtom);
  const isScreenFocused = useIsFocused();
  const activeTabRef = useRef(activeTab);
  const visibleUuidsRef = useRef<Record<string, string[]>>({});
  const refreshLockRef = useRef(false);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (!isScreenFocused) {
      return;
    }

    const timer = setInterval(() => {
      const visibleUuids = visibleUuidsRef.current[activeTabRef.current] || [];

      if (!visibleUuids.length || refreshLockRef.current) {
        return;
      }

      refreshLockRef.current = true;
      openapi
        .getTokenPriceList({ uuids: visibleUuids })
        .then(priceMap => {
          setMarketRealtimePrice(prev => ({
            ...prev,
            ...priceMap,
          }));
        })
        .catch(error => {
          console.error('market refresh visible token prices error', error);
        })
        .finally(() => {
          refreshLockRef.current = false;
        });
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [isScreenFocused, setMarketRealtimePrice]);

  return useCallback((tabId: string, uuids: string[]) => {
    visibleUuidsRef.current[tabId] = uuids;
  }, []);
};
