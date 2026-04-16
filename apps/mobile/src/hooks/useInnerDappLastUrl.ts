import { useCallback } from 'react';

import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';

type InnerDappLastUrlState = {
  lastUrlByKey: Record<string, string>;
};

const defaultState: InnerDappLastUrlState = {
  lastUrlByKey: {},
};

const innerDappLastUrlStore = zustandByMMKV<InnerDappLastUrlState>(
  '@InnerDappLastUrl',
  defaultState,
  { storage: MMKVStorageStrategy.compatJson },
);

function setInnerDappLastUrl(key: string, url: string) {
  innerDappLastUrlStore.setState(prev => {
    if (!key || !url) {
      return prev;
    }
    if (prev.lastUrlByKey[key] === url) {
      return prev;
    }
    return {
      ...prev,
      lastUrlByKey: {
        ...prev.lastUrlByKey,
        [key]: url,
      },
    };
  });
}

export function useInnerDappLastUrl() {
  const lastUrlByKey = innerDappLastUrlStore(s => s.lastUrlByKey);

  const setLastUrl = useCallback((key: string, url: string) => {
    if (!key || !url) {
      return;
    }
    setInnerDappLastUrl(key, url);
  }, []);

  return {
    lastUrlByKey,
    setLastUrl,
  };
}
