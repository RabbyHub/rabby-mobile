import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Pressable, Text, View } from 'react-native';
import InfoContainer from './InfoContainer';
import EmptyData from './EmptyData';
import { MarketSummary } from '@rabby-wallet/rabby-api/dist/types';
import { shortEllipsisAddress } from '@/utils/address';
import { formatPercent, formatAmountValueKMB, formatTime } from '../../util';
import { formatUsdValueKMB } from '@/screens/Home/utils/price';
import { formatPrice } from '@/utils/number';

const mockSummaryData = {
  '5m': {
    price: { open: 0.208, close: 0.21, change: 0.9611 },
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
    price: { open: 0.208, close: 0.21, change: 0.162 },
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
    price: { open: 0.208, close: 0.21, change: 0.2 },
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
                {data?.['5m']?.price?.change
                  ? formatPercent(data?.['5m']?.price?.change)
                  : '-'}
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
                {data?.['1h']?.price?.change
                  ? formatPercent(data?.['1h']?.price?.change)
                  : '-'}
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
                {data?.['6h']?.price?.change
                  ? formatPercent(data?.['6h']?.price?.change)
                  : '-'}
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
                {data?.['24h']?.price?.change
                  ? formatPercent(data?.['24h']?.price?.change)
                  : '-'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.summaryChartContainer}>
            <View style={styles.chartLeft}>
              <View style={styles.chatTop}>
                <Text style={styles.chatTopText}>Buy</Text>
                <Text style={styles.actionAmount}>
                  {formatAmountValueKMB(currentData?.summary?.buy?.count)}
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
                  {formatAmountValueKMB(currentData?.summary?.sell?.count)}
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
                {formatUsdValueKMB(
                  currentData?.summary?.totals?.volume_usd_value,
                )}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>Trading Count</Text>
              <Text style={styles.summaryBottomItemValue}>
                {formatAmountValueKMB(
                  currentData?.summary?.totals?.trading_count,
                )}
              </Text>
            </View>
            <View style={styles.summaryBottomItem}>
              <Text style={styles.summaryBottomItemText}>Addresses</Text>
              <Text style={styles.summaryBottomItemValue}>
                {formatAmountValueKMB(currentData?.summary?.totals?.addresses)}
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

// TODO: mock data
const mock_list_data = [
  {
    id: '123',
    action: 'buy',
    price: 123.2234424,
    amount: 123,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff80b',
    time_at: 1757183318,
  },
  {
    id: '124',
    action: 'sell',
    price: 123.000021,
    amount: 123,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff801',
    time_at: 1757677406,
  },
  {
    id: '125',
    action: 'buy',
    price: 0.000004324,
    amount: 123424233,
    usd_value: 124342343244243,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff802',
    time_at: 1757670406,
  },
  {
    id: '126',
    action: 'buy',
    price: 0.000000000001,
    amount: 123042342,
    usd_value: 123,
    tx_id: '12312312312',
    user_addr: '0xb84168cf3be63c6b8dad05ff5d755e97432ff803',
    time_at: 1757677006,
  },
];

const enum TabKey {
  all = 'all',
  buy = 'buy',
  sell = 'sell',
}

const Details = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(TabKey.all);

  return (
    <InfoContainer title={t('page.tokenDetail.marketInfo.details')}>
      {mock_list_data.length > 0 ? (
        <View style={styles.detailsContainer}>
          <View style={styles.switchTabs}>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === TabKey.all && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(TabKey.all)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === TabKey.all && styles.activeTabItemText,
                ]}>
                All
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === TabKey.buy && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(TabKey.buy)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === TabKey.buy && styles.activeTabItemText,
                ]}>
                Buy
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.switchTabItem,
                activeTab === TabKey.sell && styles.switchTabItemActive,
              ]}
              onPress={() => setActiveTab(TabKey.sell)}>
              <Text
                style={[
                  styles.switchTabItemText,
                  activeTab === TabKey.sell && styles.activeTabItemText,
                ]}>
                Sell
              </Text>
            </Pressable>
          </View>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderItem}>Type|Time</Text>
            <Text style={styles.tableHeaderItem}>Price</Text>
            <Text style={styles.tableHeaderItem}>Qnt</Text>
            <Text style={styles.tableHeaderItem}>Value</Text>
            <Text style={styles.tableHeaderItem}>Address</Text>
          </View>
          <View style={styles.tableBody}>
            {mock_list_data.map((item, index) => {
              const isBuy = item.action === 'buy';
              return (
                <View
                  key={item.user_addr}
                  style={[
                    styles.tableRow,
                    index === mock_list_data.length - 1 &&
                      styles.hideBottomBorder,
                  ]}>
                  <View style={styles.actionAndTime}>
                    <Text
                      style={[
                        styles.chatTopText,
                        !isBuy && styles.chatTopTextRight,
                      ]}>
                      {isBuy ? 'Buy' : 'Sell'}
                    </Text>
                    <Text style={styles.timeAtItem}>
                      {formatTime(item.time_at)}
                    </Text>
                  </View>
                  <Text style={styles.indexItem}>
                    {formatPrice(item.price)}
                  </Text>
                  <Text style={styles.ratioItem}>
                    {formatAmountValueKMB(item.amount)}
                  </Text>
                  <Text style={styles.amountItem}>
                    {formatUsdValueKMB(item.usd_value)}
                  </Text>
                  <Text style={styles.addressItem}>
                    {item.user_addr
                      ? shortEllipsisAddress(item.user_addr, 4)
                      : '-'}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <EmptyData />
      )}
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

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
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
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
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
    borderRadius: 6,
    width: 29,
    textAlign: 'center',
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
  switchTabs: {
    display: 'flex',
    flexDirection: 'row',
    marginTop: 12,
  },
  switchTabItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 30,
  },
  switchTabItemActive: {
    borderRadius: 8,
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
  },
  switchTabItemText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  activeTabItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
  },
  detailsContainer: {
    display: 'flex',
    flexDirection: 'column',
    paddingHorizontal: 16,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  tableHeaderItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
    alignItems: 'center',
  },
  hideBottomBorder: {
    borderBottomWidth: 0,
  },
  indexItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  ratioItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  amountItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },
  addressItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  timeAtItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  actionAndTime: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
}));
