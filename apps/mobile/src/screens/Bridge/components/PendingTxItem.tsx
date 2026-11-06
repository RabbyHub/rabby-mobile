import React, {
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { useIsFocused, useRoute } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { useScreenSceneAccountContext } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { useBridgeRecord } from '../hooks/useBridgeRecord';
import { useBridgeStatus } from '../hooks/useBridgeStatus';
import { openBridgeDetail } from '../utils/navigation';
import { openBridgeSupport } from '../utils/support';
import { BridgeProgressCard } from './BridgeProgressCard';
import { ONE_DAY_MS } from '../constants';
import { setBridgeHistoryPending } from '../hooks/historyPending';
import { getBridgeHistoryPendingStatus } from '../utils/status';

export const BridgePendingTxItem = ({
  userAddress,
  enabled = true,
  hidden = false,
  children,
}: {
  userAddress: string;
  enabled?: boolean;
  hidden?: boolean;
  children: (card: ReactNode) => ReactNode;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const focused = useIsFocused();
  const route = useRoute();
  const appState = useAppState();
  const active = enabled && focused && appState === 'active';
  const { ofScreen } = useScreenSceneAccountContext();
  const [local, setLocal] = useState<BridgeTxHistoryItem>();
  const currentLocal =
    local && isSameAddress(local.address, userAddress) ? local : undefined;
  const sceneKey = `${route.key}:${userAddress.toLowerCase()}`;
  // 卡片显隐变化时也重读，接上填入金额后新提交的交易。
  useEffect(() => {
    let disposed = false;
    if (userAddress && enabled) {
      transactionHistoryServiceApi
        .getRecentPendingTxHistory(userAddress, 'bridge')
        .then(result => {
          if (disposed) {
            return;
          }
          const item = result as BridgeTxHistoryItem | undefined;
          // 读取时将超过一天的待处理记录标为失败，并停止展示。
          if (item?.createdAt && Date.now() - item.createdAt > ONE_DAY_MS) {
            return transactionHistoryServiceApi.completeBridgeTxHistory(
              item.hash,
              item.fromChainId,
              'failed',
            );
          }
          setLocal(item);
        })
        .catch(error =>
          console.warn('[Bridge] load local history failed', error),
        );
    }
    return () => {
      disposed = true;
    };
  }, [userAddress, enabled, hidden]);
  // 仅在场景启用、页面聚焦且应用在前台时跟踪交易。
  const record = useBridgeRecord(
    {
      address: userAddress,
      local: currentLocal,
      isForMultipleAddress: ofScreen === 'MultiSwapBridge',
    },
    active && !!currentLocal,
  );
  const status = useBridgeStatus(record, active, 'card');
  const visible = !!(
    record.history ||
    (record.local && record.local.status !== 'failed')
  );
  const pending =
    active && hidden && visible ? getBridgeHistoryPendingStatus(status) : null;
  useLayoutEffect(() => {
    setBridgeHistoryPending(sceneKey, pending);
  }, [sceneKey, pending]);
  useLayoutEffect(
    () => () => setBridgeHistoryPending(sceneKey, null),
    [sceneKey],
  );
  // 卡片和报价预览由同一次渲染决定，避免提交后先画出两边。
  return (
    <>
      {children(
        visible && !hidden ? (
          <View style={styles.card}>
            <BridgeProgressCard
              status={status}
              enabled={active}
              onOpen={() => openBridgeDetail(record)}
              onSupport={openBridgeSupport}
            />
          </View>
        ) : null,
      )}
    </>
  );
};

const getStyle = createGetStyles2024(() => ({
  card: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
}));
