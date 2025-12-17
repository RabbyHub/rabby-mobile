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
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';

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
    const { styles } = useTheme2024({ getStyle: getStyles });

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
      <Card style={style}>
        <PortfolioHeader data={data} name={name} showDescription />
        <Supplements style={styles.supplements} data={supplements} />
        <TokenList
          headerStyle={styles.tokenListHeader}
          tokens={
            portfolio.detail.position_token
              ? [portfolio.detail.position_token]
              : []
          }
          name="Position"
        />
        <TokenList
          tokens={
            portfolio.detail.margin_token ? [portfolio.detail.margin_token] : []
          }
          style={styles.tokenList}
          headerStyle={styles.tokenListHeader}
          name="Margin"
        />
      </Card>
    );
  },
);

const getStyles = createGetStyles2024(() => ({
  tokenListHeader: {
    marginTop: 0,
  },
  tokenList: {
    marginTop: 2,
  },
  supplements: {
    // marginTop: 12,
  },
}));
