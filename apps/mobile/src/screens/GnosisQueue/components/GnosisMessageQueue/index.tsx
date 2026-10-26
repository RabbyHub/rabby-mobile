import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { createGetStyles } from '@/utils/styles';
import type { CHAINS_ENUM } from '@debank/common';
import { TouchableOpacity } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { GnosisMessageQueueList } from './GnosisMessageQueueList';
import type { Account } from '@/core/startupServices/preference';
import { Text } from '@/components/Typography';

const getTabs = (
  networks: string[],
  pendingMap: Record<string, SafeMessage[]>,
) => {
  const res = networks
    ?.map(networkId => {
      const chain = findChain({
        networkId: networkId,
      });
      if (!chain) {
        return;
      }
      const pendingTxs = pendingMap[chain?.network] || [];
      return {
        title: `${chain?.name} (${pendingTxs.length})`,
        key: chain.enum,
        chain,
        count: pendingTxs.length || 0,
        messages: pendingTxs,
      };
    })
    .filter(item => !!item);
  return sortBy(
    res,
    item => -(item?.count || 0),
    item => {
      return -dayjs(item?.messages?.[0]?.created || 0).valueOf();
    },
  );
};

export const GnosisMessageQueue: React.FC<{
  account: Account;
  networks?: string[];
  messages?: { networkId: string; messages: SafeMessage[] }[];
  loading: boolean;
  refreshing: boolean;
  reload(): void;
  onRefresh(): void;
}> = ({
  account,
  networks,
  messages,
  loading,
  refreshing,
  reload,
  onRefresh,
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();

  const tabs = useMemo(() => {
    return getTabs(
      networks || [],
      (messages || []).reduce((res, item) => {
        res[item.networkId] = item.messages;
        return res;
      }, {} as Record<string, SafeMessage[]>),
    );
  }, [networks, messages]);

  const [activeKey, setActiveKey] = useState<CHAINS_ENUM | null>(
    tabs[0]?.key || null,
  );

  const activeData = useMemo(() => {
    return tabs.find(item => item?.key === activeKey) || tabs[0];
  }, [tabs, activeKey]);

  useEffect(() => {
    setActiveKey(activeData?.key || null);
  }, [activeData?.key]);

  return (
    <View style={[styles.container]}>
      <View style={[styles.tabsContainer]}>
        <View style={styles.tabs}>
          {tabs?.map(tab => {
            const isActive = tab?.key === activeData?.key;
            return (
              <TouchableOpacity
                onPress={() => {
                  setActiveKey(tab?.key || null);
                }}
                key={tab?.key}>
                <View
                  style={[styles.tabsItem, isActive && styles.tabsItemActive]}>
                  <Text
                    style={[styles.tabsItemTitle, isActive && styles.active]}>
                    {tab?.title}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {activeData ? (
        <GnosisMessageQueueList
          account={account}
          pendingTxs={activeData?.messages}
          usefulChain={activeData.key}
          key={activeData.key}
          loading={loading}
          reload={reload}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.empty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <Text style={styles.emptyText}>
            {t(
              networks === undefined
                ? 'page.safeMessageQueue.loading'
                : 'page.safeMessageQueue.noData',
            )}
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'column',
    height: '100%',
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 200,
  },
  emptyText: {
    color: colors['neutral-body'],
    fontSize: 13,
  },
  tabsContainer: {
    paddingHorizontal: 20,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  tabsItem: {
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabsItemActive: {
    borderBottomColor: colors['blue-default'],
  },
  tabsItemTitle: {
    color: colors['neutral-body'],
    fontSize: 15,
    lineHeight: 18,
    paddingBottom: 4,
    fontWeight: '500',
  },
  active: {
    color: colors['blue-default'],
  },
}));
