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
        <TokenList tokens={portfolio.detail.token_list} name="POOL" />
      </Card>
    );
  },
);
