import { getChainDefaultToken } from '@/constant/swap';
import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { findChainByEnum } from '@/utils/chain';
import { formatSpeicalAmount } from '@/utils/number';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useCallback, useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import useDebounce from 'react-use/lib/useDebounce';

const useTokenInfo = ({
  userAddress,
  chain,
  defaultToken,
  refreshId,
}: {
  userAddress?: string;
  chain?: CHAINS_ENUM;
  defaultToken?: TokenItem;
  refreshId?: number;
}) => {
  const [token, setToken] = useState<
    (TokenItem & { tokenId?: string }) | undefined
  >(defaultToken);

  const { value, loading, error } = useAsync(async () => {
    if (userAddress && token?.id && chain) {
      const data = await openapi.getToken(
        userAddress,
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        token.id,
      );
      return { ...data, tokenId: token.id };
    }
  }, [refreshId, userAddress, token?.id, token?.raw_amount_hex_str, chain]);

  useDebounce(
    () => {
      if (value && !error && !loading) {
        setToken(value);
      }
    },
    300,
    [value, error, loading],
  );

  if (error) {
    console.error('token info error', chain, token?.symbol, token?.id, error);
  }
  return [token, setToken] as const;
};

export const useBuy = () => {
  const { currentAccount } = useCurrentAccount();
  const [region, setRegion] = useState('us');
  const [currency, setCurrency] = useState('usd');
  const [toToken, setToToken] = useTokenInfo({
    chain: CHAINS_ENUM.ETH,
    defaultToken: getChainDefaultToken(CHAINS_ENUM.ETH),
    userAddress: currentAccount?.address,
  });
  const [amount, setAmount] = useState('');

  const [toAmount, setToAmount] = useState('');

  const switchRegion = useCallback((region: string) => {
    setRegion(region);
  }, []);

  const switchCurrency = useCallback((currency: string) => {
    setCurrency(currency);
  }, []);

  const onPayMountChange = useCallback((value: string) => {
    const v = formatSpeicalAmount(value);
    if (!/^\d*(\.\d*)?$/.test(v)) {
      return;
    }
    setAmount(v);
  }, []);

  const onToTokenChange = useCallback(
    (t: TokenItem) => {
      setToToken(t);
    },
    [setToToken],
  );

  return {
    region,
    switchRegion,

    currency,
    switchCurrency,

    toToken,
    onToTokenChange,

    amount,
    onPayMountChange,

    toAmount,
    setToAmount,
  };
};
