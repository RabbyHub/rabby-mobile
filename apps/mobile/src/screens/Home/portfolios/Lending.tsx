import React, { useMemo } from 'react';
import { ViewStyle } from 'react-native';

import { Card } from '@/components';

import { IProtocolPortfolio } from '@/store/protocols';
import { KeyringAccountWithAlias } from '@/hooks/account';
import {
  PortfolioHeader,
  Supplements,
  TokenList,
} from '../components/PortfolioDetail';
import {
  isAave3Portfolio,
  TonTokenManageAction,
} from '../utils/protocolConfig';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

export default React.memo(
  ({
    name,
    data,
    style,
    currentAccount,
    onTokenManage,
  }: {
    name: string;
    data: IProtocolPortfolio;
    style?: ViewStyle;
    currentAccount?: KeyringAccountWithAlias;
    onTokenManage?: TonTokenManageAction;
  }) => {
    const portfolio = data._originPortfolio;

    const healthRate = portfolio.detail.health_rate;
    const supplements = [
      !!healthRate && {
        label: 'Health rate',
        content: healthRate <= 10 ? healthRate.toFixed(2) : '>10',
      },
    ];
    const isAave3 = useMemo(
      () => isAave3Portfolio(portfolio?.pool?.project_id),
      [portfolio?.pool?.project_id],
    );
    const { styles } = useTheme2024({ getStyle: getStyles });

    return (
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements data={supplements} />
        <TokenList
          tokens={portfolio.detail?.supply_token_list}
          name="supplied"
          nameStyle={isAave3 ? styles.supplyNameAave3 : undefined}
          headerStyle={isAave3 ? styles.headerAave3 : undefined}
          isAave3={isAave3}
          onTokenAction={(token, direction) => {
            onTokenManage?.(currentAccount, token.id, direction);
          }}
        />
        <TokenList
          tokens={portfolio.detail?.borrow_token_list}
          name="borrowed"
          isAave3={isAave3}
          nameStyle={isAave3 ? styles.borrowNameAave3 : undefined}
          headerStyle={isAave3 ? styles.headerAave3 : undefined}
          onTokenAction={(token, direction) => {
            onTokenManage?.(currentAccount, token.id, direction);
          }}
        />
        <TokenList
          tokens={portfolio.detail?.reward_token_list}
          name="rewards"
        />
      </Card>
    );
  },
);

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  supplyNameAave3: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
  },
  borrowNameAave3: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: colors2024['red-default'],
  },
  headerAave3: {
    backgroundColor: colors2024['neutral-bg-5'],
  },
}));
