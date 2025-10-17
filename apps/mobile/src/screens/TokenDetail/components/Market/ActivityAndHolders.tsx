import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import Activity from './Activity';
import Holder from './Holder';
import { useHolderInfo } from './hooks';
import Pools from './Pools';
import { openapi } from '@/core/request';
import { useRequest } from 'ahooks';

const enum TabKey {
  activity = 'activity',
  holders = 'holders',
  pools = 'pools',
}

const EmptyHolder = () => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.headerText]}>
          {t('page.tokenDetail.marketInfo.activity')}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={[styles.hideContent, styles.visibleContent]}>
          <Activity tokenId="" chainId="" />
        </View>
      </View>
    </View>
  );
};

const ActivityAndHolders = ({
  tokenId,
  chainId,
  hideActivity,
  symbol,
}: {
  tokenId: string;
  chainId: string;
  hideActivity?: boolean;
  symbol: string;
}) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const [activeTabKey, setActiveTabKey] = useState<TabKey>(TabKey.activity);
  const { t } = useTranslation();

  const { summaryData, detailsData, isHolderEmpty } = useHolderInfo(
    tokenId,
    chainId,
  );

  const { data: top5Pools, loading: top5PoolsLoading } = useRequest(
    async () => {
      const res = await openapi.getLiquidityPoolList({
        token_id: tokenId,
        chain_id: chainId,
      });
      return res;
    },
  );

  // only show holders
  if (hideActivity) {
    if (
      !summaryData?.ratio_top10 &&
      !summaryData?.ratio_top100 &&
      !detailsData?.data_list.length
    ) {
      return <EmptyHolder />;
    }
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text
            style={[styles.headerText, styles.activeText]}
            onPress={() => setActiveTabKey(TabKey.holders)}>
            {t('page.tokenDetail.marketInfo.holders')}
          </Text>
        </View>
        <View style={styles.content}>
          <View style={[styles.hideContent, styles.visibleContent]}>
            <Holder
              top10ratio={summaryData?.ratio_top10 || 0}
              top100ratio={summaryData?.ratio_top100 || 0}
              data={detailsData?.data_list || []}
              isEmpty={isHolderEmpty}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          style={[
            styles.headerText,
            activeTabKey === TabKey.activity && styles.activeText,
          ]}
          onPress={() => setActiveTabKey(TabKey.activity)}>
          {t('page.tokenDetail.marketInfo.activity')}
        </Text>
        {isHolderEmpty ? null : (
          <Text
            style={[
              styles.headerText,
              activeTabKey === TabKey.holders && styles.activeText,
            ]}
            onPress={() => setActiveTabKey(TabKey.holders)}>
            {t('page.tokenDetail.marketInfo.holders')}
          </Text>
        )}

        {!!top5Pools?.length && (
          <Text
            style={[
              styles.headerText,
              activeTabKey === TabKey.pools && styles.activeText,
            ]}
            onPress={() => setActiveTabKey(TabKey.pools)}>
            {t('page.tokenDetail.marketInfo.pools')}
          </Text>
        )}
      </View>
      <View style={styles.content}>
        <View
          style={[
            styles.hideContent,
            activeTabKey === TabKey.activity && styles.visibleContent,
          ]}>
          <Activity tokenId={tokenId} chainId={chainId} />
        </View>
        <View
          style={[
            styles.hideContent,
            activeTabKey === TabKey.holders && styles.visibleContent,
          ]}>
          <Holder
            top10ratio={summaryData?.ratio_top10 || 0}
            top100ratio={summaryData?.ratio_top100 || 0}
            data={detailsData?.data_list || []}
            isEmpty={isHolderEmpty}
          />
        </View>
        <View
          style={[
            styles.hideContent,
            !!top5Pools?.length &&
              activeTabKey === TabKey.pools &&
              styles.visibleContent,
          ]}>
          <Pools
            tokenId={tokenId}
            chainId={chainId}
            symbol={symbol}
            top5Pools={top5Pools || []}
            top5PoolsLoading={top5PoolsLoading}
          />
        </View>
      </View>
    </View>
  );
};

export default ActivityAndHolders;

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    position: 'relative',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  header: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    fontWeight: '700',
  },
  activeText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '900',
  },
  content: {
    marginTop: 12,
  },
  activityContent: {
    borderWidth: 1,
  },
  hideContent: {
    opacity: 0,
    zIndex: -1,
    position: 'absolute',
    left: 99999,
  },
  visibleContent: {
    opacity: 1,
    zIndex: 1,
    position: 'relative',
    left: 0,
  },
}));
