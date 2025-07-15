import React, { useMemo, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import SearchEntry from './SearchEntry';
import { EmptyWatchlist } from './EmptyHolder';
import { TokenListItem } from './TokenItem';
import TokenHeader, { SortState } from './TokenHeader';

const mockData = [
  {
    id: '0x00869e8e2e0343edd11314e6ccb0d78d51547ee5',
    chain: 'eth',
    name: 'SuperGrok',
    symbol: 'SUPERGROK',
    display_symbol: null,
    optimized_symbol: 'SUPERGROK',
    decimals: 18,
    logo_url: null,
    protocol_id: '',
    price: 0.0005811616181186771,
    price_24h_change: 65.42711913507235,
    credit_score: 3840.9306577879083,
    is_verified: true,
    is_scam: false,
    is_suspicious: null,
    is_core: true,
    is_wallet: true,
    time_at: 1752489467,
    low_credit_score: true,
    buy_amount: 465077647.79331,
    buy_usd_value: 60754.914710000005,
    buy_count: 110,
    buy_address_count: 47,
    token_create_at: 1752489467,
    price_change: 65.42711913507235,
    liquidity: 54951.25384416214,
    pnl_usd_value: 26292.229221253037,
    create_at: 1752489815,
    fdv: 581161.618118677,
    price_curve_24h: [
      { time_at: 1752492917, price: 0.000009160807316637815 },
      { time_at: 1752499646, price: 0.00021921823803538063 },
      { time_at: 1752506375, price: 0.00022415495369162327 },
      { time_at: 1752513104, price: 0.00025731065405792307 },
      { time_at: 1752519833, price: 0.00024308230795574499 },
      { time_at: 1752526562, price: 0.00011298108703035208 },
      { time_at: 1752533291, price: 0.00009218513195542182 },
      { time_at: 1752540020, price: 0.0002707039394683799 },
      { time_at: 1752546749, price: 0.0007669302598482458 },
      { time_at: 1752553478, price: 0.0005054250009880731 },
      { time_at: 1752560207, price: 0.0005167448071212683 },
      { time_at: 1752566937, price: 0.0005811616181186771 },
    ],
  },
  {
    id: '0x69ebf265f86ccd67db5ce8c9fbe30243981b92ea',
    chain: 'eth',
    name: 'Ani Grok Companion',
    symbol: 'Ani',
    display_symbol: null,
    optimized_symbol: 'Ani',
    decimals: 18,
    logo_url: null,
    protocol_id: '',
    price: 0.000596636285273295,
    price_24h_change: 12.268097501489022,
    credit_score: 68443.53161833038,
    is_verified: true,
    is_scam: false,
    is_suspicious: null,
    is_core: true,
    is_wallet: true,
    time_at: 1752489335,
    low_credit_score: false,
    buy_amount: 1024265349.4374914,
    buy_usd_value: 166197.0660897536,
    buy_count: 202,
    buy_address_count: 100,
    token_create_at: 1752489335,
    price_change: 12.268097501489022,
    liquidity: 50932.037675078485,
    pnl_usd_value: 88808.40879674965,
    create_at: 1752489395,
    fdv: 596636.285273295,
    price_curve_24h: [
      { time_at: 1752492917, price: 0.000048039731581598726 },
      { time_at: 1752499646, price: 0.00006245523433761811 },
      { time_at: 1752506375, price: 0.00003705793225329993 },
      { time_at: 1752513104, price: 0.00007285457826168828 },
      { time_at: 1752519833, price: 0.0004179091499349297 },
      { time_at: 1752526562, price: 0.00033511072040359665 },
      { time_at: 1752533291, price: 0.00037611319438406914 },
      { time_at: 1752540020, price: 0.00025009212222188077 },
      { time_at: 1752546749, price: 0.00030672299424424845 },
      { time_at: 1752553478, price: 0.00032697393176984063 },
      { time_at: 1752560207, price: 0.0008216214107856698 },
      { time_at: 1752566937, price: 0.000596636285273295 },
    ],
  },
  {
    id: '0x276cb617fbf4d77466a860c0bc967c309c912c13',
    chain: 'eth',
    name: 'CHAD GROK COMPANION',
    symbol: 'CHAD',
    display_symbol: null,
    optimized_symbol: 'CHAD',
    decimals: 9,
    logo_url: null,
    protocol_id: '',
    price: 0.00026466230503700546,
    price_24h_change: 5.718245893672858,
    credit_score: 58159.135853478365,
    is_verified: true,
    is_scam: false,
    is_suspicious: null,
    is_core: true,
    is_wallet: true,
    time_at: 1752501035,
    low_credit_score: false,
    buy_amount: 528591418.1056057,
    buy_usd_value: 108845.9066152462,
    buy_count: 162,
    buy_address_count: 69,
    token_create_at: 1752501035,
    price_change: 5.718245893672858,
    liquidity: 26629.86624862046,
    pnl_usd_value: 20576.75299542154,
    create_at: 1752502619,
    fdv: 264662.30503700546,
    price_curve_24h: [
      { time_at: 1752507320, price: 0.000035567915819662456 },
      { time_at: 1752512739, price: 0.0000715383697771996 },
      { time_at: 1752518159, price: 0.0004459105693068355 },
      { time_at: 1752523579, price: 0.0004042127105612093 },
      { time_at: 1752528998, price: 0.00022343292306299217 },
      { time_at: 1752534418, price: 0.0002568250609911511 },
      { time_at: 1752539838, price: 0.0002793124414804119 },
      { time_at: 1752545258, price: 0.0002361913912797374 },
      { time_at: 1752550677, price: 0.0002625455341097317 },
      { time_at: 1752556097, price: 0.0003415757163488385 },
      { time_at: 1752561517, price: 0.0002751506223393338 },
      { time_at: 1752566937, price: 0.00026466230503700546 },
    ],
  },
];

function WatchlistScreen(): JSX.Element {
  const { styles } = useTheme2024({ getStyle });
  const [tokenSort, setTokenSort] = useState<SortState>('default');
  const [changeSort, setChangeSort] = useState<SortState>('default');

  const list = useMemo(() => {
    return mockData.sort((a, b) => {
      if (tokenSort !== 'default') {
        if (tokenSort === 'asc') {
          return a.fdv - b.fdv;
        }
        return b.fdv - a.fdv;
      }
      if (changeSort !== 'default') {
        if (changeSort === 'asc') {
          return a.price_24h_change - b.price_24h_change;
        }
        return b.price_24h_change - a.price_24h_change;
      }
      return b.fdv - a.fdv;
    });
  }, [tokenSort, changeSort]);

  return (
    <NormalScreenContainer2024
      type="bg0"
      overwriteStyle={styles.overwriteStyle}>
      <EmptyWatchlist />
      <ScrollView style={styles.scrollView}>
        <TokenHeader
          tokenSort={tokenSort}
          onTokenSort={() => {
            setTokenSort(tokenSort === 'asc' ? 'desc' : 'asc');
            setChangeSort('default');
          }}
          changeSort={changeSort}
          onChangeSort={() => {
            setChangeSort(changeSort === 'asc' ? 'desc' : 'asc');
            setTokenSort('default');
          }}
        />
        {list.map(item => (
          <TokenListItem key={item.id} item={item} onPress={() => {}} />
        ))}
      </ScrollView>
      <SearchEntry />
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(() => ({
  overwriteStyle: {
    paddingTop: 0,
    position: 'relative',
  },
  scrollView: {
    paddingHorizontal: 12,
  },
}));

export default WatchlistScreen;
