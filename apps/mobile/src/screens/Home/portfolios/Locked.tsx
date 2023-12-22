import React from 'react';
import dayjs from 'dayjs';
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

    const supplements = [
      !!portfolio.detail.unlock_at && {
        label: 'Unlock at',
        content: dayjs(Number(portfolio.detail.unlock_at) * 1000).format(
          'YYYY/MM/DD',
        ),
      },
    ];

    return (
      <Card style={style} shadow>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={portfolio.detail.supply_token_list}
          name="SUPPLIED"
        />
        <TokenList tokens={portfolio.detail.reward_token_list} name="REWARDS" />
      </Card>
    );
  },
);
