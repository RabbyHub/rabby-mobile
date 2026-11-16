import { RootNames } from '@/constant/layout';
import { naviPush } from '@/utils/navigation';
import type { BridgeRecordData } from './statusTypes';

export function openBridgeDetail(record: BridgeRecordData) {
  naviPush(RootNames.StackTransaction, {
    screen: RootNames.BridgeDetail,
    params: record,
  });
}
