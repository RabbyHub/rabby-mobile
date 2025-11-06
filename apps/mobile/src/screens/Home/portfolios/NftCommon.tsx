import React from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { PortfolioHeader, TokenList } from '../components/PortfolioDetail';
import { AbstractPortfolio } from '../types';
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

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio?.detail?.supply_token_list}
          nfts={portfolio?.detail?.supply_nft_list}
          name="supplied"
        />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio?.detail?.reward_token_list}
          name="rewards"
        />
      </Card>
    );
  },
);
