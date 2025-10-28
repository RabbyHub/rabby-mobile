import React from 'react';
import { Text, View, ViewStyle } from 'react-native';

import { Card } from '@/components';

import { AbstractPortfolio } from '../types';
import { PortfolioHeader } from '../components/PortfolioDetail';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { formatAmount, formatPrice } from '@/utils/number';
import { formatNetworth } from '@/utils/math';
import { useTranslation } from 'react-i18next';

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
    const { t } = useTranslation();

    return (
      <Card style={style} shadow>
        <PortfolioHeader data={data} name={name} showDescription />
        <View style={styles.poolContainer}>
          <Text style={styles.nameText}>{portfolio.detail.name}</Text>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.headerText}>
                {t('component.Prediction.side')}
              </Text>
              <Text style={styles.headerText}>
                {t('component.Prediction.amount')}
              </Text>
              <Text style={styles.headerText}>
                {t('component.Prediction.price')}
              </Text>
              <Text style={[styles.headerText, styles.contentTextRight]}>
                {t('component.Prediction.usdValue')}
              </Text>
            </View>
            <View style={styles.content}>
              <Text style={styles.contentText}>{portfolio.detail.side}</Text>
              <Text style={styles.contentText}>
                {formatAmount(portfolio.detail.amount ?? 0)}
              </Text>
              <Text style={styles.contentText}>
                {formatPrice(portfolio.detail.price ?? 0)}
              </Text>
              <Text style={[styles.contentText, styles.contentTextRight]}>
                {formatNetworth(portfolio.stats.net_usd_value ?? 0)}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  },
);

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  poolContainer: {
    marginTop: 14,
    paddingHorizontal: 12,
  },
  container: {
    marginTop: 8,
    gap: 4,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  contentText: {
    fontSize: 14,
    flex: 1,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  contentTextRight: {
    textAlign: 'right',
  },
}));
