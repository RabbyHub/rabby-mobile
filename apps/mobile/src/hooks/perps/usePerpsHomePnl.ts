import { useMemoizedFn } from 'ahooks';
import { useEffect } from 'react';
import { apisPerps } from './../../core/apis/perps';
import { usePerpsStore } from './usePerpsStore';

export const usePerpsHomePnl = () => {
  const { state: perpsState, setHomePositionPnl } = usePerpsStore();

  const fetch = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    const account = await apisPerps.getPerpsCurrentAccount();
    if (account?.address) {
      const res = await sdk.info.getClearingHouseState(account.address);
      if (res.assetPositions.length === 0 || !res?.assetPositions) {
        setHomePositionPnl({ pnl: 0, show: false });
      } else {
        const pnl = res.assetPositions.reduce((acc, asset) => {
          return acc + Number(asset.position.unrealizedPnl);
        }, 0);
        setHomePositionPnl({ pnl, show: true });
      }
    } else {
      setHomePositionPnl({ pnl: 0, show: false });
    }
  });

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    perpsPositionInfo: perpsState.homePositionPnl,
  };
};
