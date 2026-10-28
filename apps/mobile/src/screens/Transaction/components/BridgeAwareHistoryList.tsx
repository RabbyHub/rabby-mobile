import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import { useMemoizedFn } from 'ahooks';
import { isEqual } from 'lodash';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { BridgeHistoryItem } from '@/components2024/HistoryItem/BridgeHistoryItem';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type {
  BridgeTxHistoryItem,
  TransactionGroup,
} from '@/core/services/transactionHistory';
import type { HistoryDisplayItem } from '@/types/history';
import type { Account } from '@/types/account';
import { isSupportDBAccount } from '@/utils/account';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { openBridgeDetail } from '@/screens/Bridge/utils/navigation';
import { useBridgeHistoryByTxIds } from '../hooks/useBridgeHistoryByTxIds';
import {
  bridgeSourceKey,
  historyTxKey,
  mergeHistoryWithBridge,
  isBridgeHistoryRow,
  type BridgeAwareHistoryItem,
  type BridgeHistoryRow,
} from '../utils/bridgeHistory';
import { HistoryList } from './HistoryGroupList';

type Props = Omit<React.ComponentProps<typeof HistoryList>, 'list'> & {
  list: (HistoryDisplayItem | TransactionGroup)[];
  accounts: Account[];
  scopeKey: string;
};

export function BridgeAwareHistoryList({
  bridgeEnabled,
  accounts,
  scopeKey,
  ...props
}: Props & { bridgeEnabled: boolean }) {
  if (!bridgeEnabled) {
    return <HistoryList {...props} />;
  }
  return (
    <BridgeHistoryListContent key={scopeKey} accounts={accounts} {...props} />
  );
}

function BridgeHistoryListContent({
  accounts,
  ...props
}: Omit<Props, 'scopeKey'>) {
  const focused = useIsFocused();
  const appState = useAppState();
  const active = focused && appState === 'active';
  const items = useMemo(
    () => props.list.filter(item => 'project_item' in item),
    [props.list],
  );
  const pollableKeys = useMemo(() => {
    const byAddress = new Map(
      accounts.map(account => [account.address.toLowerCase(), account]),
    );
    return new Set(
      items
        .filter(item =>
          isSupportDBAccount(
            props.account ||
              item.account ||
              byAddress.get(item.address.toLowerCase()),
          ),
        )
        .map(item => historyTxKey(item.chain, item.id)),
    );
  }, [accounts, items, props.account]);
  const {
    records,
    onVisibleItemsChange: onVisibleQueriesChange,
    refresh,
  } = useBridgeHistoryByTxIds({
    items,
    pollableKeys,
    active,
  });
  const list = useMemo(
    () => mergeHistoryWithBridge(props.list, records),
    [props.list, records],
  );
  const [rowStore] = useState(() =>
    createStore<BridgeRowState>(() => ({
      active,
      visibleKeys: new Set(),
      localByHash: new Map(),
    })),
  );
  useEffect(() => {
    rowStore.setState({ active });
  }, [rowStore, active]);
  const localAddressKey = useMemo(
    () =>
      [
        ...new Set(
          list.flatMap(item =>
            isBridgeHistoryRow(item) ? [item.source.address.toLowerCase()] : [],
          ),
        ),
      ]
        .sort()
        .join(','),
    [list],
  );
  // 本地记录仅补充已识别条目，按页面批量读取，不新增本地轮询或写入。
  useEffect(() => {
    let current = true;
    if (active && localAddressKey) {
      Promise.all(
        localAddressKey
          .split(',')
          .map(address =>
            transactionHistoryServiceApi.getBridgeTxHistory(address),
          ),
      )
        .then(results => {
          const localByHash = buildLocalByHash(results.flat());
          if (
            current &&
            !isEqual(rowStore.getState().localByHash, localByHash)
          ) {
            rowStore.setState({ localByHash });
          }
        })
        .catch(error =>
          console.warn('[BridgeHistory] load local records failed', error),
        );
    }
    return () => {
      current = false;
    };
  }, [rowStore, active, localAddressKey]);
  const renderBridgeItem = useMemoizedFn((row: BridgeHistoryRow) => (
    <BridgeRow
      row={row}
      store={rowStore}
      isForMultipleAddress={props.isForMultipleAddress}
    />
  ));
  const onVisibleItemsChange = useMemoizedFn(
    (visible: BridgeAwareHistoryItem[]) => {
      const keys = new Set(
        visible.filter(isBridgeHistoryRow).map(item => item.key),
      );
      const previous = rowStore.getState().visibleKeys;
      if (
        previous.size !== keys.size ||
        [...keys].some(key => !previous.has(key))
      ) {
        rowStore.setState({ visibleKeys: keys });
      }
      onVisibleQueriesChange(visible);
    },
  );
  const onRefresh = useMemoizedFn(() => {
    props.onRefresh?.();
    refresh();
  });
  return (
    <HistoryList
      {...props}
      list={list}
      renderBridgeItem={renderBridgeItem}
      onVisibleItemsChange={onVisibleItemsChange}
      onRefresh={props.onRefresh ? onRefresh : undefined}
    />
  );
}

type BridgeRowState = {
  active: boolean;
  visibleKeys: Set<string>;
  localByHash: Map<string, BridgeTxHistoryItem>;
};

function buildLocalByHash(locals: BridgeTxHistoryItem[]) {
  const result = new Map<string, BridgeTxHistoryItem>();
  for (const local of locals) {
    result.set(historyTxKey(local.fromToken.chain, local.hash), local);
    if (local.acceleratedHash) {
      result.set(
        historyTxKey(local.fromToken.chain, local.acceleratedHash),
        local,
      );
    }
  }
  return result;
}

// 行内自行订阅可见性与本地记录，列表 cell 不随这些状态整体重渲染。
function BridgeRow({
  row,
  store,
  isForMultipleAddress,
}: {
  row: BridgeHistoryRow;
  store: StoreApi<BridgeRowState>;
  isForMultipleAddress?: boolean;
}) {
  const { styles } = useTheme2024({ getStyle });
  const enabled = useStore(
    store,
    state => state.active && state.visibleKeys.has(row.key),
  );
  const local = useStore(store, state =>
    state.localByHash.get(bridgeSourceKey(row.history)),
  );
  return (
    <View style={styles.bridgeRow}>
      <BridgeHistoryItem
        data={row.history}
        local={local}
        enabled={enabled}
        onPress={() =>
          openBridgeDetail({
            address: row.source.address,
            history: row.history,
            local,
            isForMultipleAddress,
          })
        }
      />
    </View>
  );
}

const getStyle = createGetStyles2024(() => ({
  bridgeRow: { marginBottom: 8 },
}));
