import React from 'react';
import dayjs from 'dayjs';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import {
  PortfolioHeader,
  TokenList,
  Supplements,
} from '../components/PortfolioDetail';
import { AbstractPortfolio } from '../types';
import { formatPriceMainsite } from '@/utils/math';
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

    const optionsType = portfolio.detail.type;
    const strikePrice = portfolio.detail.underlying_token?.amount
      ? formatPriceMainsite(
          (portfolio.detail.strike_token?.amount || 0) /
            portfolio.detail.underlying_token?.amount,
        )
      : '';
    const exerciseEnd = portfolio.detail.exercise_end_at;

    const supplements = [
      !!optionsType && {
        label: 'Type',
        content: optionsType,
      },
      !!strikePrice && {
        label: 'Strike price',
        content:
          strikePrice + ' ' + getTokenSymbol(portfolio.detail.strike_token),
      },
      !!exerciseEnd && {
        label: 'Exercise end',
        content: dayjs(Number(exerciseEnd) * 1000).format('YYYY/MM/DD'),
      },
    ];

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={
            portfolio.detail.underlying_token
              ? [portfolio.detail.underlying_token]
              : []
          }
          name="UNDERLYING"
        />
        <TokenList
          tokens={portfolio.detail.collateral_token_list}
          name="COLLATERAL"
        />
      </Card>
    );
  },
);
