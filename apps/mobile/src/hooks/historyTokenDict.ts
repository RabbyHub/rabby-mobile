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
  '@HistoryTimeDict',
  {} as Record<string, number>,
);

const historyEnsureNoDataBase = atomByMMKV<Record<string, boolean>>(
  '@historyEnsureNoDataDict',
  {} as Record<string, boolean>,
);

export function useHistoryTokenDict() {
  const [tokenDict, setTokenDict] = useAtom(storeTokenBase);
  const [projectDict, setProjectDict] = useAtom(storeProjectBase);
  const [updateHistoryTime, setUpdateHistoryTime] = useAtom(historyTimetBase);
  const [historyEnsureNoData, setHistoryEnsureNoData] = useAtom(
    historyEnsureNoDataBase,
  );

  const updateHistoryTimeSingleAddress = (add: string) => {
    setUpdateHistoryTime(prev => ({
      ...prev,
      [add]: Date.now(),
    }));
  };

  const resetUpdateHistoryTime = useCallback(() => {
    setUpdateHistoryTime({});
  }, [setUpdateHistoryTime]);

  return {
    projectDict,
    setProjectDict,
    tokenDict,
    setTokenDict,
    resetUpdateHistoryTime,
    updateHistoryTime,
    updateHistoryTimeSingleAddress,
    historyEnsureNoData,
    setHistoryEnsureNoData,
  };
}
