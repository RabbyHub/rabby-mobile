import { useEffect, useMemo, useRef, useState } from 'react';
import { useMemoizedFn } from 'ahooks';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import { getPerpsAccountRuntimeContext } from '@/hooks/perps/usePerpsStore';

type Side = 'tp' | 'sl';
type SetParams = {
  coin: string;
  tpTriggerPx: string;
  slTriggerPx: string;
  direction: 'Long' | 'Short';
};

/** Prices and cancellation IDs always come from the same confirmed snapshot. */
export function useSimplePositionTpSl({
  coin,
  orders,
  setOrder,
  cancelOrder,
}: {
  coin: string;
  orders: readonly OpenOrder[] | undefined;
  setOrder: (
    params: SetParams,
    isSceneCurrent: () => boolean,
  ) => Promise<boolean>;
  cancelOrder: (
    oids: readonly number[],
    coin: string,
    side: Side,
    isSceneCurrent: () => boolean,
  ) => Promise<boolean>;
}) {
  const projection = useMemo(() => {
    const tp: OpenOrder[] = [];
    const sl: OpenOrder[] = [];
    for (const order of orders ?? []) {
      if (!order.isTrigger || !order.isPositionTpsl || !order.reduceOnly)
        continue;
      if (order.orderType === 'Take Profit Market') tp.push(order);
      if (order.orderType === 'Stop Market') sl.push(order);
    }
    return { tp, sl };
  }, [orders]);

  const generation = getPerpsAccountRuntimeContext().generation;
  const scene = useRef({ coin, generation });
  if (scene.current.coin !== coin || scene.current.generation !== generation) {
    scene.current = { coin, generation };
  }
  type Scene = typeof scene.current;
  const inFlight = useRef<Partial<Record<Side, Scene>>>({});
  const [pending, setPending] = useState<Partial<Record<Side, Scene>>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useMemoizedFn(
    async (
      side: Side,
      action: (isSceneCurrent: () => boolean) => Promise<boolean>,
    ) => {
      const context = scene.current;
      const isCurrent = () =>
        mounted.current &&
        scene.current === context &&
        getPerpsAccountRuntimeContext().generation === context.generation;
      if (!isCurrent() || inFlight.current[side] === context) return false;
      inFlight.current[side] = context;
      setPending(previous => ({ ...previous, [side]: context }));
      try {
        const success = await action(isCurrent);
        return isCurrent() && success;
      } finally {
        if (inFlight.current[side] === context) {
          delete inFlight.current[side];
          if (mounted.current) {
            setPending(previous => ({ ...previous, [side]: undefined }));
          }
        }
      }
    },
  );

  const handleSetAutoClose = useMemoizedFn((params: SetParams) => {
    if (params.coin !== coin) return Promise.resolve(false);
    return run(params.tpTriggerPx ? 'tp' : 'sl', isCurrent =>
      setOrder(params, isCurrent),
    );
  });
  const handleCancelAutoClose = useMemoizedFn(async (side: Side) => {
    // Cancel every confirmed same-side leg; the tag shows only the first.
    const oids = projection[side].map(order => order.oid);
    if (!oids.length) return;
    await run(side, isCurrent => cancelOrder(oids, coin, side, isCurrent));
  });

  return {
    contextKey: `${coin}:${generation}`,
    tpPrice: projection.tp[0]?.triggerPx,
    slPrice: projection.sl[0]?.triggerPx,
    tpPending: pending.tp === scene.current,
    slPending: pending.sl === scene.current,
    handleSetAutoClose,
    handleCancelAutoClose,
  };
}
