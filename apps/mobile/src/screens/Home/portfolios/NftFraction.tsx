import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { PortfolioHeader, TokenList } from '../components/PortfolioDetail';
import { IProtocolPortfolio } from '@/store/protocols';

export default React.memo(
  ({
    name,
    data,
    style,
  }: {
    name: string;
    data: IProtocolPortfolio;
    style?: ViewStyle;
  }) => {
    const portfolio = data._originPortfolio;

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <TokenList
          fraction={{
            collection: portfolio.detail.collection!,
            value: portfolio.stats.net_usd_value,
            shareToken: portfolio.detail.share_token!,
          }}
          name="COLLECTION"
        />
      </Card>
    );
  },
);
