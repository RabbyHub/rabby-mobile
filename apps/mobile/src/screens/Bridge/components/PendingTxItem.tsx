import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAppState } from '@react-native-community/hooks';
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

export const BridgePendingTxItem = ({
  userAddress,
  onDisplayChange,
  enabled = true,
}: {
  userAddress: string;
  onDisplayChange?: (visible: boolean) => void;
  enabled?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const focused = useIsFocused();
  const appState = useAppState();
  const active = enabled && focused && appState === 'active';
  const { ofScreen } = useScreenSceneAccountContext();
  const [local, setLocal] = useState<BridgeTxHistoryItem>();
  // 地址或启用状态变化时重读本地记录，避免继续显示上一地址的交易。
  useEffect(() => {
    let disposed = false;
    setLocal(undefined);
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
  }, [userAddress, enabled]);
  // 仅在场景启用、页面聚焦且应用在前台时跟踪交易。
  const record = useBridgeRecord(
    {
      address: userAddress,
      local,
      isForMultipleAddress: ofScreen === 'MultiSwapBridge',
    },
    active && !!local,
  );
  const status = useBridgeStatus(record, active, 'card');
  const visible = !!(record.local || record.history);
  // 同步卡片显示状态，供父组件调整底部信息。
  useEffect(() => {
    onDisplayChange?.(visible);
    return () => onDisplayChange?.(false);
  }, [visible, onDisplayChange]);
  if (!visible) {
    return null;
  }
  return (
    <View style={styles.card}>
      <BridgeProgressCard
        status={status}
        enabled={active}
        onOpen={() => openBridgeDetail(record)}
        onSupport={openBridgeSupport}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(() => ({
  card: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
}));
