import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { AbstractPortfolio } from '../types';
import {
  PortfolioHeader,
  Supplements,
  TokenList,
} from '../components/PortfolioDetail';
import { KeyringAccountWithAlias } from '@/hooks/account';

export default React.memo(
  ({
    name,
    data,
    style,
    currentAccount,
    onClickToken,
  }: {
    name: string;
    data: AbstractPortfolio;
    style?: ViewStyle;
    currentAccount?: KeyringAccountWithAlias;
    onClickToken?: (
      tokenAddress: string,
      direction: 'supply' | 'borrow',
    ) => void;
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
          currentAccount={currentAccount}
          tokens={portfolio.detail?.supply_token_list}
          onClickToken={
            onClickToken ? addr => onClickToken?.(addr, 'supply') : undefined
          }
          name="supplied"
        />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio.detail?.borrow_token_list}
          onClickToken={
            onClickToken ? addr => onClickToken?.(addr, 'borrow') : undefined
          }
          name="borrowed"
        />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio.detail?.reward_token_list}
          name="rewards"
        />
      </Card>
    );
  },
);
