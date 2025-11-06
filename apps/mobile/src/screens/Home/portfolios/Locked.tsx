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
import { KeyringAccountWithAlias } from '@/hooks/account';

export default React.memo(
  ({
    name,
    data,
    style,
    currentAccount,
  }: {
    name: string;
    data: AbstractPortfolio;
    style?: ViewStyle;
    currentAccount?: KeyringAccountWithAlias;
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
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio.detail.supply_token_list}
          name="supplied"
        />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio.detail.reward_token_list}
          name="rewards"
        />
      </Card>
    );
  },
);
