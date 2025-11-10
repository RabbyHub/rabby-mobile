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
import { formatAmount } from '@/utils/math';
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

    const claimableAmount = portfolio.detail.token?.claimable_amount;
    const dailyUnlockAmount = portfolio.detail.daily_unlock_amount;
    const endAt = portfolio.detail.end_at;

    const supplements = [
      !!claimableAmount && {
        label: 'Claimable',
        content: formatAmount(claimableAmount),
      },
      !!endAt && {
        label: 'End at',
        content: dayjs(Number(endAt) * 1000).format('YYYY/MM/DD'),
      },
      !!dailyUnlockAmount && {
        label: 'Daily unlock',
        content: formatAmount(dailyUnlockAmount),
      },
    ];

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          currentAccount={currentAccount}
          tokens={portfolio.detail.token ? [portfolio.detail.token] : []}
          name="POOL"
        />
      </Card>
    );
  },
);
