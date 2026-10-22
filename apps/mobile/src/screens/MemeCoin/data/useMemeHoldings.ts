import { useMemo } from 'react';
import useTokenList from '@/store/tokens';
import { deriveMemeHoldings } from './market';
import { useMemeMarketStore } from './memeMarketStore';

export const useMemeHoldings = (address: string | undefined) => {
  const tokens = useTokenList(s =>
    address ? s.tokenListMap[address.toLowerCase()] : undefined,
  );
  const market = useMemeMarketStore(s => s.list);
  return useMemo(
    () => deriveMemeHoldings(tokens || [], market),
    [tokens, market],
  );
};
