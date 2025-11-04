import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { AbstractPortfolio } from '../types';
import {
  PortfolioHeader,
  Supplements,
  TokenList,
} from '../components/PortfolioDetail';

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

    const debtRatio = portfolio.detail.debt_ratio;
    const supplements = [
      !!debtRatio && {
        label: 'Debt Ratio',
        content: debtRatio.toFixed(2),
      },
    ];

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={portfolio.detail.supply_token_list}
          name="supplied"
        />
        <TokenList tokens={portfolio.detail.reward_token_list} name="rewards" />
        <TokenList
          tokens={portfolio.detail.borrow_token_list}
          name="borrowed"
        />
      </Card>
    );
  },
);
