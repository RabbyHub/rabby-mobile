import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { AbstractPortfolio } from '../types';
import { PortfolioHeader, TokenList } from '../components/PortfolioDetail';

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
        <TokenList
          tokens={portfolio?.detail?.supply_token_list}
          name="supplied"
        />
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
