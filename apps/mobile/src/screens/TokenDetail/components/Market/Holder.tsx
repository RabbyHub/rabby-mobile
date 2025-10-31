import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import EmptyData from './EmptyData';
import { formatPercent, formatAmountValueKMB } from '../../util';
import AddressView from './AddressView';

interface SummaryProps {
  top10ratio: number;
  top100ratio: number;
}

const Summary = ({ top10ratio, top100ratio }: SummaryProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <View style={styles.summary}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryItemTitle}>
          {t('page.tokenDetail.marketInfo.holderSections.top10HoldersRatio')}
        </Text>
        <Text style={styles.summaryItemValue}>{formatPercent(top10ratio)}</Text>
      </View>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryItemTitle}>
          {t('page.tokenDetail.marketInfo.holderSections.top100HoldersRatio')}
        </Text>
        <Text style={styles.summaryItemValue}>
          {formatPercent(top100ratio)}
        </Text>
      </View>
    </View>
  );
};

interface DetailsProps {
  data: {
    user_addr?: string;
    amount?: number;
    ratio?: number;
  }[];
}
const Details = ({ data }: DetailsProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <View style={styles.details}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderItem, styles.firstItem]}>#</Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.holderSections.tableHeader.ratio')}
        </Text>
        <Text style={styles.tableHeaderItem}>
          {t('page.tokenDetail.marketInfo.holderSections.tableHeader.position')}
        </Text>
        <Text style={[styles.tableHeaderItem, styles.lastItem]}>
          {t('page.tokenDetail.marketInfo.holderSections.tableHeader.address')}
        </Text>
      </View>
      <View style={styles.tableBody}>
        {data.map((item, index) => (
          <View
            key={item.user_addr}
            style={[
              styles.tableRow,
              index === data.length - 1 && styles.hideBottomBorder,
            ]}>
            <Text style={styles.indexItem}>{index + 1}</Text>
            <Text style={styles.ratioItem}>
              {item.ratio ? formatPercent(item.ratio) : '-'}
            </Text>
            <Text style={styles.amountItem}>
              {item.amount ? formatAmountValueKMB(item.amount) : '-'}
            </Text>
            <View style={styles.addressItem}>
              <AddressView address={item.user_addr || ''} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

interface HolderProps {
  top10ratio: number;
  top100ratio: number;
  data: {
    user_addr?: string;
    amount?: number;
    ratio?: number;
  }[];
  isEmpty: boolean;
}
const Holder = ({ top10ratio, top100ratio, data, isEmpty }: HolderProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  if (isEmpty) {
    return (
      <View style={styles.container}>
        <EmptyData />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Summary top100ratio={top100ratio} top10ratio={top10ratio} />
      <Details data={data} />
    </View>
  );
};

export default Holder;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
  },
  summary: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryItem: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-4'],
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
    flex: 1,
  },
  summaryItemTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
  },
  summaryItemValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
  },

  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  tableHeader: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tableHeaderItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  firstItem: {
    flex: 0,
    width: 60,
  },
  lastItem: {
    flex: 1,
    textAlign: 'right',
  },
  tableBody: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
  hideBottomBorder: {
    borderBottomWidth: 0,
  },
  indexItem: {
    fontSize: 12,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    width: 60,
  },
  ratioItem: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  amountItem: {
    fontSize: 12,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    flex: 1,
  },
  addressItem: {
    display: 'flex',
    flex: 1,
  },
}));
