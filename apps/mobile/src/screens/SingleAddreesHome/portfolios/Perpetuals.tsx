import React from 'react';
import { Text, ViewStyle } from 'react-native';

import { Card } from '@/components';

import {
  PortfolioHeader,
  TokenList,
  Supplements,
} from '../components/PortfolioDetail';
import { AbstractPortfolio } from '../types';
import { formatNetworth } from '@/utils/math';
import { getTokenSymbol } from '@/utils/token';

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

    const tradePair =
      getTokenSymbol(portfolio.detail.base_token) +
      '/' +
      getTokenSymbol(portfolio.detail.quote_token);
    const side = portfolio.detail.side;
    const leverage = portfolio.detail.leverage;
    const pnl = portfolio.detail.pnl_usd_value;

    const supplements = [
      !!tradePair && {
        label: 'Trade pair',
        content: tradePair,
      },
      !!side && {
        label: 'Side',
        content: side,
      },
      !!leverage && {
        label: 'Leverage',
        content: `${leverage.toFixed(2)}x`,
      },
      !!pnl && {
        label: 'P&L',
        content: (
          <Text style={{ color: pnl < 0 ? 'red' : 'green' }}>{`${
            pnl > 0 ? '+' : ''
          }${formatNetworth(pnl)}`}</Text>
        ),
      },
    ];

    return (
      <Card style={style} shadow>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={
            portfolio.detail.position_token
              ? [portfolio.detail.position_token]
              : []
          }
          name="POSITION"
        />
        <TokenList
          tokens={
            portfolio.detail.margin_token ? [portfolio.detail.margin_token] : []
          }
          name="MARGIN"
        />
      </Card>
    );
  },
);
