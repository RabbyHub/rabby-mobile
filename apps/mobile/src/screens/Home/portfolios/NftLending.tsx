import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import {
  PortfolioHeader,
  Supplements,
  TokenList,
} from '../components/PortfolioDetail';
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

    const healthRate = portfolio.detail.health_rate;
    const supplements = [
      !!healthRate && {
        label: 'Health rate',
        content: healthRate <= 10 ? healthRate.toFixed(2) : '>10',
      },
    ];

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={portfolio?.detail?.supply_token_list}
          nfts={portfolio?.detail?.supply_nft_list}
          name="supplied"
        />
        <TokenList
          tokens={portfolio?.detail?.borrow_token_list}
          name="borrowed"
        />
      </Card>
    );
  },
);
