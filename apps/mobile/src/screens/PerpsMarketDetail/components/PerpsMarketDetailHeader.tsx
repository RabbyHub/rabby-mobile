import React, { useCallback, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { RootNames } from '@/constant/layout';
import { naviReplace } from '@/utils/navigation';
import { PerpsHeaderTitle } from './PerpsHeaderTitle';
import {
  PerpsMarketSelectorSheet,
  type PerpsMarketSelectorSheetHandle,
} from './PerpsMarketSelectorSheet';
import type { AccountHeaderHandle } from './account/model';
import { registerPerpsHeaderHandle } from './headerPresentationRegistry';

// The navigator owns this header from the first descriptor. Its identity is
// available from the route even before market metadata or positions load.
// It also owns the market selector sheet, so the screen never swaps the header
// after mount: the scroll snapshot arrives through the route-keyed registry.
export function PerpsMarketDetailHeader({
  market,
  routeKey = '',
}: {
  market: string;
  routeKey?: string;
}) {
  const { displayName, logoUrl, quoteCoin } = perpsStore(
    useShallow(state => ({
      displayName: state.marketDataMap[market]?.displayName || market,
      logoUrl: state.marketDataMap[market]?.logoUrl,
      quoteCoin: state.marketDataMap[market]?.quoteAsset,
    })),
  );

  const marketSelectorRef = useRef<PerpsMarketSelectorSheetHandle>(null);

  const registerHeaderHandle = useCallback(
    (handle: AccountHeaderHandle | null) => {
      registerPerpsHeaderHandle(routeKey, handle);
    },
    [routeKey],
  );

  const selectMarket = useCallback((nextMarket: string) => {
    naviReplace(RootNames.StackTransaction, {
      screen: RootNames.PerpsMarketDetail,
      params: {
        market: nextMarket,
        fromSource: 'marketDetail',
        showOpenPosition: false,
        direction: 'Long',
      },
    });
  }, []);

  return (
    <>
      <PerpsHeaderTitle
        ref={registerHeaderHandle}
        popupIsOpen={false}
        coin={market}
        displayName={displayName}
        logoUrl={logoUrl}
        quoteCoin={quoteCoin}
        onSelectCoin={() => marketSelectorRef.current?.present()}
      />
      <PerpsMarketSelectorSheet
        currentMarket={market}
        onSelect={selectMarket}
        ref={marketSelectorRef}
      />
    </>
  );
}
