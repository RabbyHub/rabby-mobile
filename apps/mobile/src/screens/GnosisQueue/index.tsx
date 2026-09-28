import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { PillsSwitch } from '@/components2024/PillSwitch';
import { useGnosisNetworks } from '@/hooks/gnosis/useGnosisNetworks';
import { useGnosisPendingMessages } from '@/hooks/gnosis/useGnosisPendingMessages';
import { useGnosisPendingTxs } from '@/hooks/gnosis/useGnosisPendingTxs';
import { useThemeColors } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GnosisMessageQueue } from './components/GnosisMessageQueue';
import { GnosisTransactionQueue } from './components/GnosisTransactionQueue';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import type { GetNestedScreenRouteProp } from '@/navigation-type';

export const GnosisQueueScreen = () => {
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        'GnosisTransactionQueue'
      >
    >();
  const account = route.params.account;
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { bottom } = useSafeAreaInsets();

  const isFocused = useIsFocused();
  const { data: networks, syncNetworks } = useGnosisNetworks({
    address: account.address,
    active: isFocused,
  });
  const networksKey = networks?.join(',');
  const pendingOptions = {
    ready: isFocused && networks !== undefined,
    refreshDeps: [account.address, networksKey],
    staleTime: 0,
  };
  const {
    data: pendingTxs,
    loading: transactionsLoading,
    refresh: refreshTransactions,
    cancel: cancelTransactions,
  } = useGnosisPendingTxs(
    { address: account.address },
    {
      ...pendingOptions,
      cacheKey: `gnosis-queue-transactions-${account.address.toLowerCase()}-${networksKey}`,
    },
  );
  const {
    data: messages,
    loading: messagesLoading,
    refresh: refreshMessages,
    cancel: cancelMessages,
  } = useGnosisPendingMessages(
    { address: account.address },
    {
      ...pendingOptions,
      cacheKey: `gnosis-queue-messages-${account.address.toLowerCase()}-${networksKey}`,
    },
  );
  const {
    run: handleRefresh,
    loading: refreshing,
    cancel: cancelRefresh,
  } = useRequest(
    async () => {
      await syncNetworks();
      // A topology change can supersede these requests through refreshDeps.
      // Track the latest requests' loading state, not their canceled Promises.
      refreshTransactions();
      refreshMessages();
    },
    { manual: true },
  );
  useEffect(() => {
    if (!isFocused) {
      cancelTransactions();
      cancelMessages();
      cancelRefresh();
    }
  }, [cancelMessages, cancelRefresh, cancelTransactions, isFocused]);

  const { transactionsCount, messagesCount } = useMemo(() => {
    const currentNetworks = new Set(networks);
    return {
      transactionsCount: (pendingTxs?.results || []).reduce(
        (count, item) =>
          count + (currentNetworks.has(item.networkId) ? item.txs.length : 0),
        0,
      ),
      messagesCount: (messages?.results || []).reduce(
        (count, item) =>
          count +
          (currentNetworks.has(item.networkId) ? item.messages.length : 0),
        0,
      ),
    };
  }, [messages, networks, pendingTxs]);
  const total = transactionsCount + messagesCount;

  const tabs = useMemo(() => {
    return [
      {
        label: `Transaction (${transactionsCount})`,
        key: 'transaction' as const,
      },
      {
        label: `Message (${messagesCount})`,
        key: 'message' as const,
      },
    ];
  }, [transactionsCount, messagesCount]);

  const [activeKey, setActiveKey] = useState<'transaction' | 'message'>(
    tabs[0]?.key,
  );

  useEffect(() => {
    setNavigationOptions({
      headerTitle: t('page.safeQueue.title', {
        total: total,
      }),
    });
  }, [setNavigationOptions, t, total]);

  return (
    <NormalScreenContainer
      style={[
        {
          paddingBottom: bottom,
        },
        styles.container,
      ]}>
      <View style={styles.header}>
        <PillsSwitch
          options={tabs}
          value={activeKey}
          onTabChange={setActiveKey}
        />
      </View>
      <View style={styles.body}>
        {activeKey === 'transaction' ? (
          <GnosisTransactionQueue
            account={account}
            networks={networks}
            pendingTxs={pendingTxs?.results}
            loading={transactionsLoading}
            reload={refreshTransactions}
            refreshing={refreshing || transactionsLoading || messagesLoading}
            onRefresh={handleRefresh}
          />
        ) : (
          <GnosisMessageQueue
            account={account}
            networks={networks}
            messages={messages?.results}
            loading={messagesLoading}
            reload={refreshMessages}
            refreshing={refreshing || transactionsLoading || messagesLoading}
            onRefresh={handleRefresh}
          />
        )}
      </View>
    </NormalScreenContainer>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flexDirection: 'column',
    paddingBottom: 20,
  },
  header: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  body: {
    flex: 1,
  },
}));
