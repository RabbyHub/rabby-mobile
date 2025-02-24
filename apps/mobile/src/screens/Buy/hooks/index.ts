import { toast } from '@/components2024/Toast';
import { RootNames } from '@/constant/layout';
import { getChainDefaultToken } from '@/constant/swap';
import { openapi } from '@/core/request';
import { useCurrentAccount } from '@/hooks/account';
import { TransactionNavigatorParamList } from '@/navigation-type';
import { formatSpeicalAmount } from '@/utils/number';
import { CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useNavigationState } from '@react-navigation/native';
import { atom, useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { getCountry } from 'react-native-localize';
import useAsync from 'react-use/lib/useAsync';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';

const regionListAtom = atom<
  Awaited<ReturnType<typeof openapi.getBuySupportedCountryList>>
>([]);

regionListAtom.onMount = set => {
  set([]);
  openapi.getBuySupportedCountryList().then(s => {
    set(s);
  });
};

const useTokenInfo = ({
  userAddress,
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
    if (userAddress && token?.id) {
      const data = await openapi.getToken(userAddress, token.chain, token.id);

      return { ...data, tokenId: token.id };
    }
  }, [refreshId, userAddress, token?.id, token?.raw_amount_hex_str]);

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
    console.error('token info error', token?.symbol, token?.id, error);
  }
  return [token, setToken] as const;
};

export const useBuy = (isForMultipleAdderss?: boolean) => {
  const navState = useNavigationState(
    s =>
      s.routes.find(
        r =>
          r.name ===
          (isForMultipleAdderss ? RootNames.MultiBuy : RootNames.Buy),
      )?.params,
  ) as TransactionNavigatorParamList['Buy'] | undefined;

  const { currentAccount } = useCurrentAccount({ disableAutoFetch: true });
  const [region, setRegion] = useState(getCountry());
  const [currency, setCurrency] = useState('usd');
  const [toToken, setToToken] = useTokenInfo({
    defaultToken:
      navState?.receiveToken || getChainDefaultToken(CHAINS_ENUM.ETH),
    userAddress: currentAccount?.address,
  });
  const [amount, setAmount] = useState('');

  const [activeProvider, setActiveProvider] = useState<string>('');

  const regionList = useAtomValue(regionListAtom);

  const [refreshId, _refresh] = useState(0);

  const refreshQuotes = useCallback(() => {
    _refresh(e => e + 1);
  }, []);

  const switchRegion = useCallback((v: string) => {
    setRegion(v);
  }, []);

  const switchCurrency = useCallback((v: string) => {
    setCurrency(v);
  }, []);

  const onPayMountChange = useCallback((value: string) => {
    const v = formatSpeicalAmount(value);
    if (!/^\d*(\.\d*)?$/.test(v)) {
      return;
    }
    setAmount(v);
  }, []);

  const [loading, setLoading] = useState(false);

  const fetchRef = useRef<Promise<any>>();

  const [{ value: _quotes, error }, getBuyQuotes] = useAsyncFn(async () => {
    if (
      currentAccount?.address &&
      region &&
      toToken &&
      currency &&
      Number(amount) > 0
    ) {
      const data = openapi
        .getBuyQuote({
          user_addr: currentAccount?.address,
          country_code: region,
          usd_amount: amount,
          receive_token_uuid: `${toToken?.chain}:${toToken?.id}`,
        })
        .then(async res => {
          const sortedData = res.sort(
            (a, b) => b.token_amount - a.token_amount,
          );
          const paymentMethods = await Promise.allSettled(
            sortedData.map(e =>
              openapi.getBuyPaymentMethods({
                country_code: region,
                service_provider: e.service_provider.id,
              }),
            ),
          );

          const data: ((typeof res)[number] & {
            paymentMethod?: Awaited<
              ReturnType<typeof openapi.getBuyPaymentMethods>
            >;
          })[] = [...sortedData];
          paymentMethods.forEach((item, idx) => {
            if (item.status === 'fulfilled') {
              data[idx].paymentMethod = item.value;
            }
          });
          return data;
        })
        .finally(() => {
          if (data === fetchRef.current) {
            setLoading(false);
          }
        });

      fetchRef.current = data;

      return data;
    }
  }, [amount, region, currency, currentAccount?.address, toToken]);

  const [, cancel] = useDebounce(getBuyQuotes, 1000, [
    amount,
    region,
    currency,
    currentAccount?.address,
    toToken,
    refreshId,
  ]);

  const isReady =
    !!currentAccount?.address &&
    !!region &&
    !!toToken &&
    !!currency &&
    Number(amount) > 0;

  const quotes = useMemo(() => {
    if (_quotes && isReady) {
      return _quotes;
    }
    return;
  }, [_quotes, isReady]);

  useEffect(() => {
    if (
      currentAccount?.address &&
      region &&
      toToken &&
      currency &&
      Number(amount) > 0
    ) {
      setLoading(true);
    } else {
      setLoading(false);
      cancel();
    }
  }, [
    amount,
    region,
    currency,
    currentAccount?.address,
    toToken,
    cancel,
    refreshId,
  ]);

  useEffect(() => {
    if (error) {
      toast.error(String(error));
    }
  }, [error]);

  useDebounce(
    () => {
      if (!loading && !error && quotes?.[0]?.service_provider?.id) {
        setActiveProvider(quotes[0].service_provider?.id);
        Keyboard.dismiss();
        console.log('Keyboard.dismiss');
      }
    },
    100,
    [quotes, error, loading],
  );

  const onToTokenChange = useCallback(
    (t: TokenItem) => {
      setToToken(t);
    },
    [setToToken],
  );

  const tokenAmount = useMemo(() => {
    if (isReady && !loading && !error && quotes?.length && activeProvider) {
      return (
        quotes.find(e => e.service_provider.id === activeProvider)
          ?.token_amount || ''
      );
    }
    return '';
  }, [isReady, loading, error, quotes, activeProvider]);

  const noQuote = useMemo(
    () => isReady && !loading && !quotes?.length,
    [isReady, loading, quotes?.length],
  );

  return {
    currentAddr: currentAccount?.address,
    regionList,
    region,
    switchRegion,

    currency,
    switchCurrency,

    toToken,
    onToTokenChange,

    amount,
    onPayMountChange,

    tokenAmount,

    activeProvider,
    setActiveProvider,

    loading,
    quotes,
    noQuote,

    refreshQuotes,
  };
};
