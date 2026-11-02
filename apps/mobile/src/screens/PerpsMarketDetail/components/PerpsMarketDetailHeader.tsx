import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { RootNames } from '@/constant/layout';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { naviReplace } from '@/utils/navigation';
import { PerpsHeaderTitle } from './PerpsHeaderTitle';

// The navigator owns this header from the first descriptor. Its identity is
// available from the route even before market metadata or positions load.
export function PerpsMarketDetailHeader({ market }: { market: string }) {
  const { displayName, logoUrl, quoteCoin } = perpsStore(
    useShallow(state => ({
      displayName: state.marketDataMap[market]?.displayName || market,
      logoUrl: state.marketDataMap[market]?.logoUrl,
      quoteCoin: state.marketDataMap[market]?.quoteAsset,
    })),
  );

  return (
    <PerpsHeaderTitle
      popupIsOpen={false}
      coin={market}
      displayName={displayName}
      logoUrl={logoUrl}
      quoteCoin={quoteCoin}
      onSelectCoin={() => {
        naviReplace(RootNames.StackTransaction, {
          screen: RootNames.PerpsSearch,
          params: {
            openFromSource: 'marketDetail',
            initialTab: 'topVolume',
          },
        });
      }}
    />
  );
}
