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

const isFristFetchDataBase = atomByMMKV<boolean>(
  '@HistoryIsFristFetchData',
  true,
);

export function useHistoryTokenDict() {
  const [tokenDict, setTokenDict] = useAtom(storeTokenBase);
  const [projectDict, setProjectDict] = useAtom(storeProjectBase);
  const [isFristFetchData, setIsFristFetchData] = useAtom(isFristFetchDataBase);

  return {
    projectDict,
    setProjectDict,
    tokenDict,
    setTokenDict,
    isFristFetchData,
    setIsFristFetchData,
  };
}
