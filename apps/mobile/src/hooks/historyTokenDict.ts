import { useCallback } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { atomByMMKV } from '@/core/storage/mmkv';
import { TxAllHistoryResult } from '@rabby-wallet/rabby-api/dist/types';

const storeTokenBase = atomByMMKV<TxAllHistoryResult['token_uuid_dict']>(
  '@HistoryTokenDict',
  {} as TxAllHistoryResult['token_uuid_dict'],
);

const storeProjectBase = atomByMMKV<TxAllHistoryResult['project_dict']>(
  '@HistoryProjectDict',
  {} as TxAllHistoryResult['project_dict'],
);

const historyTimetBase = atomByMMKV<Record<string, number>>(
  '@HistoryProjectDict',
  {} as Record<string, number>,
);

export function useHistoryTokenDict() {
  const [tokenDict, setTokenDict] = useAtom(storeTokenBase);
  const [projectDict, setProjectDict] = useAtom(storeProjectBase);
  const [updateHistoryTime, setUpdateHistoryTime] = useAtom(historyTimetBase);

  const updateHistoryTimeSingleAddress = (add: string) => {
    setUpdateHistoryTime(prev => ({
      ...prev,
      [add]: Date.now(),
    }));
  };
  return {
    projectDict,
    setProjectDict,
    tokenDict,
    setTokenDict,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
  };
}
