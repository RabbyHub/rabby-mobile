import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable, Text, View } from 'react-native';
import InfoContainer from './InfoContainer';
import EmptyData from './EmptyData';
import { MarketSummary } from '@rabby-wallet/rabby-api/dist/types';

const mockSummaryData = {
  '5m': {
    price: { open: 0.208, close: 0.21, change: 0.96 },
    summary: {
      buy: { count: 3210, volume_amount: 185432.12 },
      sell: { count: 2198, volume_amount: 171003.55 },
      totals: {
        trading_count: 6118,
        volume_usd_value: 3516435.67,
        volume_amount: 3122312.312,
        addresses: 5211,
      },
    },
  },
  '1h': {
    price: { open: 0.208, close: 0.21, change: 0.16 },
    summary: {
      buy: { count: 320, volume_amount: 185432.12 },
      sell: { count: 298, volume_amount: 171003.55 },
      totals: {
        trading_count: 618,
        volume_usd_value: 356435.67,
        volume_amount: 312312312.312,
        addresses: 521,
      },
    },
  },
  '6h': {
    price: { open: 0.208, close: 0.21, change: 0.26 },
    summary: {
      buy: { count: 320, volume_amount: 185432.12 },
      sell: { count: 298, volume_amount: 171003.55 },
      totals: {
        trading_count: 618,
        volume_usd_value: 356435.67,
        volume_amount: 312312312.312,
        addresses: 521,
      },
    },
  },
  '24h': {
    price: { open: 0.208, close: 0.21, change: 0.46 },
    summary: {
      buy: { count: 320, volume_amount: 185432.12 },
      sell: { count: 298, volume_amount: 171003.55 },
      totals: {
        trading_count: 618,
        volume_usd_value: 356435.67,
        volume_amount: 312312312.312,
        addresses: 521,
      },
    },
  },
};

interface ISummaryData {
  data?: MarketSummary;
}

const enum TabKey {
  '5m' = '5m',
  '1h' = '1h',
  '6h' = '6h',
  '24h' = '24h',
}

const Summary = ({ data }: ISummaryData) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState(TabKey['5m']);
  const currentData = useMemo(() => data?.[activeTab], [data, activeTab]);

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.summary')}>
      {data ? (
        <View style={styles.summaryContainer}>
          <View style={styles.switchContainer}>
            <Pressable
              onPress={() => setActiveTab(TabKey['5m'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['5m'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>5 Min</Text>
              <Text style={styles.switchItemPercentage}>
                {data?.['5m']?.price?.change}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['1h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['1h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>1 Hour</Text>
              <Text style={styles.switchItemPercentage}>
                {data?.['1h']?.price?.change}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['6h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['6h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>6 Hour</Text>
              <Text style={styles.switchItemPercentage}>
                {data?.['6h']?.price?.change}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab(TabKey['24h'])}
              style={[
                styles.switchItem,
                activeTab === TabKey['24h'] && styles.activeItem,
              ]}>
              <Text style={styles.switchItemText}>24 Hour</Text>
              <Text style={styles.switchItemPercentage}>
                {data?.['24h']?.price?.change}
              </Text>
            </Pressable>
          </View>
          <View style={styles.summaryChartContainer}>
            <View style={styles.chartLeft}>
              <View style={styles.chatTop}>
                <Text style={styles.chatTopText}>Buy</Text>
                <Text style={styles.actionAmount}>
                  {currentData?.summary?.buy?.count}
                </Text>
              </View>
              <View style={styles.chatBottomLine} />
            </View>
            <View style={styles.chartRight}>
              <View style={[styles.chatTop, styles.chatTopRight]}>
                <Text style={[styles.chatTopText, styles.chatTopTextRight]}>
                  Sell
                </Text>
                <Text style={[styles.actionAmount, styles.actionAmountRight]}>
                  {currentData?.summary?.sell?.count}
                </Text>
              </View>
              <View
                style={[styles.chatBottomLine, styles.chatBottomLineRight]}
              />
            </View>
          </View>
          <View style={styles.summaryBottomContainer}>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>Volume</Text>
              <Text style={styles.summaryBottomItemValue}>
                {currentData?.summary?.totals?.volume_usd_value}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>Trading Count</Text>
              <Text style={styles.summaryBottomItemValue}>
                {currentData?.summary?.totals?.trading_count}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>Addresses</Text>
              <Text style={styles.summaryBottomItemValue}>
                {currentData?.summary?.totals?.addresses}
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <EmptyData />
      )}
    </InfoContainer>
  );
};

const Details = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.details')}>
      <EmptyData />
    </InfoContainer>
  );
};

const Activity = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={styles.container}>
      <Summary data={mockSummaryData} />
      <Details />
    </View>
  );
};

export default Activity;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    gap: 12,
  },
  summary: {
    color: colors2024['red-default'],
  },
  details: {
    color: colors2024['red-default'],
  },
  summaryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },
  switchContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  switchItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 7,
  },
  activeItem: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 8,
  },
  switchItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  switchItemPercentage: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '700',
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
  },
  summaryChartContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
  },
  chartLeft: {
    flex: 1,
    gap: 12,
  },
  chartRight: {
    flex: 1,
    gap: 12,
  },
  chatTop: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatTopRight: {
    justifyContent: 'flex-end',
  },
  chatTopText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    backgroundColor: colors2024['green-light-4'],
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: 'hidden',
  },
  actionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
  },
  actionAmountRight: {
    color: colors2024['red-default'],
  },
  chatTopTextRight: {
    color: colors2024['red-default'],
    backgroundColor: colors2024['red-light-2'],
  },
  chatBottomLine: {
    height: 4,
    borderRadius: 20,
    backgroundColor: colors2024['green-default'],
  },
  chatBottomLineRight: {
    backgroundColor: colors2024['red-default'],
  },
  summaryBottomContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryBottomItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 6,
  },
  summaryBottomItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
  },
  summaryBottomItemValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
  },
}));
