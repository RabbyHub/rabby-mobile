import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { PortfolioHeader, TokenList } from '../components/PortfolioDetail';
import { AbstractPortfolio } from '../types';

export default React.memo(
  ({
    name,
    data,
    style,
  }: {
    name: string;
    data: AbstractPortfolio;
    style?: ViewStyle;
  }) => {
    const portfolio = data._originPortfolio;

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <TokenList nfts={portfolio?.detail?.supply_nft_list} name="supplied" />
        <TokenList
          tokens={portfolio?.detail?.borrow_token_list}
          name="borrowed"
        />
        <TokenList
          tokens={portfolio?.detail?.reward_token_list}
          name="rewards"
        />
      </Card>
    );
  },
);
