import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HistoryList } from './components/HistoryGroupList';
import { openapi } from '@/core/request';
import { unionBy, orderBy } from 'lodash';
import { useRequest } from 'ahooks';
import PQueue from 'p-queue';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Empty } from './components/Empty';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { HistoryDisplayItem } from './MultiAddressHistory';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { toast } from '@/components2024/Toast';

const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('empty', () => {
      if (q.pending <= 0) resolve(null);
    });
  });
};

function HistoryFilterScamScreen({
  route,
}: {
  route?: { params: { addresses: KeyringAccountWithAlias[] } };
}): JSX.Element {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const { bottom } = useSafeAreaInsets();

  const { accounts } = useMyAccounts();
  const unionAccounts = useMemo(() => {
    return unionBy(accounts, account => account.address.toLowerCase());
  }, [accounts]);

  const batchFetchData = async () => {
    const list: HistoryDisplayItem[] = [];
    const accountList = route?.params.addresses || unionAccounts;
    const queue = new PQueue();
    for (let i = 0; i < accountList.length; i++) {
      queue.add(async () => {
        const account = accountList[i];
        if (!account) {
          return;
        }
        try {
          const addr = account.address.toLowerCase();
          const result = await fetchData(addr);
          list.push(...result.list);
        } catch (e) {
          toast.error(`${account.address} load failed, ${JSON.stringify(e)}`);
        }
      });
    }
    await waitQueueFinished(queue);
    return { list: orderBy(list, 'time_at', 'desc') };
  };

  const fetchData = async (address: string) => {
    if (!address) {
      throw new Error('no account');
    }

    const getHistory = openapi.getAllTxHistory;

    const res = await getHistory({
      id: address,
    });

    const {
      project_dict,
      cate_dict,
      token_uuid_dict,
      history_list: list,
    } = res;
    const displayList = list
      .filter(item => !item.is_scam)
      .map(item => ({
        ...item,
        projectDict: project_dict,
        cateDict: cate_dict,
        tokenDict: token_uuid_dict,
        address,
        key: `${address}_${item.chain}_${item.id}`,
      }));
    return {
      list: displayList,
    };
  };

  const { data, loading } = useRequest(() => batchFetchData(), {
    refreshDeps: [],
  });

  if (!loading && !data?.list?.length) {
    return <Empty />;
  }

  return (
    <NormalScreenContainer2024
      type="bg1"
      style={{
        paddingBottom: bottom,
        paddingTop: 24,
      }}>
      <View style={{ paddingTop: 24 }}>
        {loading ? (
          <Text style={styles.loadingText}>
            Loading may take a moment, and data delays are possible
          </Text>
        ) : null}
        <HistoryList loading={loading} list={data?.list} />
      </View>
    </NormalScreenContainer2024>
  );
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    loadingText: {
      color: colors['neutral-body'],
      fontSize: 12,
      lineHeight: 14,
      marginBottom: 20,
      textAlign: 'center',
    },
  });

export default HistoryFilterScamScreen;
