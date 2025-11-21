import { useMemoizedFn } from 'ahooks';
import { useCallback, useEffect } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { usePerpsStore } from './usePerpsStore';
import { useFocusEffect } from '@react-navigation/native';

export const usePerpsHomePnl = () => {
  const { state: perpsState, setHomePositionPnl } = usePerpsStore();

  const fetch = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    const account = await apisPerps.getPerpsCurrentAccount();
    if (account?.address) {
      const res = await sdk.info.getClearingHouseState(account.address);
      if (res.assetPositions.length === 0 || !res?.assetPositions) {
        setHomePositionPnl({
          pnl: 0,
          show: true,
          type: 'accountValue',
          accountValue: Number(res.marginSummary.accountValue),
        });
      } else {
        const pnl = res.assetPositions.reduce((acc, asset) => {
          return acc + Number(asset.position.unrealizedPnl);
        }, 0);
        setHomePositionPnl({
          pnl,
          show: true,
          type: 'pnl',
          accountValue: Number(res.marginSummary.accountValue),
        });
      }
    } else {
      setHomePositionPnl({
        pnl: 0,
        show: false,
        type: 'accountValue',
        accountValue: 0,
      });
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
