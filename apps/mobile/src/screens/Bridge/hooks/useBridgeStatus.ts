import { useEffect, useState } from 'react';
import { useInterval } from 'ahooks';
import { getBridgeStatus } from '../utils/status';
import type { BridgeRecordData } from '../utils/statusTypes';

export function useBridgeStatus(
  data: BridgeRecordData,
  enabled = true,
  surface: 'card' | 'detail' = 'detail',
) {
  const [now, setNow] = useState(Date.now);
  const status = getBridgeStatus(data, now);
  // 重新启用时校准时间，避免倒计时停留在离开前的数值。
  useEffect(() => {
    if (enabled) {
      setNow(Date.now());
    }
  }, [enabled]);
  // 仅按当前场景需要更新本地时钟，停用或终态时停止计时。
  const interval = enabled ? status.refreshMs[surface] : undefined;
  useInterval(() => setNow(Date.now()), interval);
  return status;
}
