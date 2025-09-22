import { useGnosisNetworks } from '@/hooks/gnosis/useGnosisNetworks';
import { useGnosisPendingTxs } from '@/hooks/gnosis/useGnosisPendingTxs';
import { useThemeColors } from '@/hooks/theme';
import { findChain, findChainByEnum } from '@/utils/chain';
import { createGetStyles } from '@/utils/styles';
import { CHAINS_ENUM } from '@debank/common';
import { TouchableOpacity } from '@gorhom/bottom-sheet';
import type { SafeTransactionItem } from '@rabby-wallet/gnosis-sdk/dist/api';
import dayjs from 'dayjs';
import { sortBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { GnosisTransactionQueueList } from './GnosisTransactionQueueList';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apisSafe } from '@/core/apis/safe';
import { Account } from '@/core/services/preference';

const getTabs = (
  networks: string[],
  pendingMap: Record<string, SafeTransactionItem[]>,
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
        txs: pendingTxs,
      };
    })
    .filter(item => !!item);
  return sortBy(
    res,
    item => -(item?.count || 0),
    item => {
      return -dayjs(item?.txs?.[0]?.submissionDate || 0).valueOf();
    },
  );
};

export const GnosisTransactionQueue: React.FC<{
  account: Account;
}> = ({ account }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();

  const { data: networks } = useGnosisNetworks({ address: account?.address });
  const {
    data: pendingTxs,
    loading,
    refreshAsync,
  } = useGnosisPendingTxs({
    address: account?.address,
  });

  const tabs = useMemo(() => {
    return getTabs(
      networks || [],
      (pendingTxs?.results || []).reduce((res, item) => {
        res[item.networkId] = item.txs;
        return res;
      }, {} as Record<string, SafeTransactionItem[]>),
    );
  }, [networks, pendingTxs]);

  const [activeKey, setActiveKey] = useState<CHAINS_ENUM | null>(
    tabs[0]?.key || null,
  );

  const activeData = useMemo(() => {
    return tabs.find(item => item?.chain?.enum === activeKey);
  }, [tabs, activeKey]);

  useEffect(() => {
    setActiveKey(tabs[0]?.key || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs[0]?.key]);

  // useEffect(() => {
  //   if (account?.address) {
  //     apisSafe.syncGnosisNetworks(account?.address);
  //   }
  // }, [account?.address]);
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container]}>
      <View style={[styles.tabsContainer]}>
        <View style={styles.tabs}>
          {tabs?.map(tab => {
            const isActive = tab?.key === activeKey;
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
      {activeKey && findChainByEnum(activeKey) && (
        <GnosisTransactionQueueList
          account={account}
          pendingTxs={activeData?.txs}
          usefulChain={activeKey}
          key={activeKey}
          loading={loading}
          reload={refreshAsync}
        />
      )}
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'column',
    height: '100%',
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
