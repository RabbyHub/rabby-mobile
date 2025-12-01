import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { initialState, usePerpsStore } from './usePerpsStore';
import { useFocusEffect } from '@react-navigation/native';
import { formatPositionPnl } from '@/utils/perps';

export const usePerpsHomePnl = () => {
  const { state: perpsState, setHomePositionPnl } = usePerpsStore();

  const fetch = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    const account = await apisPerps.getPerpsCurrentAccount();
    if (account?.address) {
      const res = await sdk.info.getClearingHouseState(account.address);
      const pnl = formatPositionPnl(res);
      setHomePositionPnl(pnl);
    } else {
      setHomePositionPnl(initialState.homePositionPnl);
    }
  });

  useFocusEffect(
    useCallback(() => {
      fetch();
    }, [fetch]),
  );

  return {
    perpsPositionInfo: perpsState.homePositionPnl,
  };
};
