import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  runOnJS,
  useAnimatedReaction,
  type SharedValue,
} from 'react-native-reanimated';

const TRADE_DISPLAY_OVERSCAN = 48;

type TradeDisplayGeometry = {
  tradeTop: number | null;
  tradeBottom: number | null;
  viewportHeight: number | null;
};

export const isPerpsProTradeDisplayVisible = ({
  scrollY,
  tradeTop,
  tradeBottom,
  viewportHeight,
}: TradeDisplayGeometry & { scrollY: number }): boolean => {
  'worklet';
  if (
    tradeTop == null ||
    tradeBottom == null ||
    viewportHeight == null ||
    !Number.isFinite(scrollY) ||
    !Number.isFinite(tradeTop) ||
    !Number.isFinite(tradeBottom) ||
    !Number.isFinite(viewportHeight) ||
    tradeTop < 0 ||
    tradeBottom <= tradeTop ||
    viewportHeight <= 0
  ) {
    return true;
  }

  return (
    tradeBottom - scrollY > -TRADE_DISPLAY_OVERSCAN &&
    tradeTop - scrollY < viewportHeight + TRADE_DISPLAY_OVERSCAN
  );
};

// This is only a display hint. It must not gate trading or source subscriptions.
export const usePerpsProTradeDisplayVisibility = ({
  accountIdentity,
  scrollY,
  tradeTop,
  tradeBottom,
  viewportHeight,
}: TradeDisplayGeometry & {
  accountIdentity: string | null;
  scrollY: SharedValue<number>;
}): boolean => {
  const geometry = useMemo(
    () => ({ accountIdentity, scrollY, tradeTop, tradeBottom, viewportHeight }),
    [accountIdentity, scrollY, tradeTop, tradeBottom, viewportHeight],
  );
  const [snapshot, setSnapshot] = useState(() => ({
    geometry,
    generation: 0,
    visible: true,
  }));
  // New measurements/identity are allowed immediately, before the UI reaction.
  const currentSnapshot =
    snapshot.geometry === geometry
      ? snapshot
      : { geometry, generation: snapshot.generation + 1, visible: true };
  if (currentSnapshot !== snapshot) {
    setSnapshot(currentSnapshot);
  }
  const generation = currentSnapshot.generation;
  const activePresentation = useRef<{
    generation: number;
    visible: boolean;
  } | null>(null);
  useLayoutEffect(() => {
    activePresentation.current = { generation, visible: true };
    return () => {
      activePresentation.current = null;
    };
  }, [generation]);

  const publishVisibility = useCallback(
    (nextGeneration: number, visible: boolean) => {
      const active = activePresentation.current;
      if (active?.generation !== nextGeneration || active.visible === visible) {
        return;
      }
      active.visible = visible;
      setSnapshot(current =>
        current.generation === nextGeneration
          ? { ...current, visible }
          : current,
      );
    },
    [],
  );

  useAnimatedReaction(
    () => ({
      generation,
      visible: isPerpsProTradeDisplayVisible({
        scrollY: scrollY.value,
        tradeTop,
        tradeBottom,
        viewportHeight,
      }),
    }),
    (current, previous) => {
      // Reanimated retains `previous` when a mapper is rebuilt. A new geometry
      // starts from the same permissive default as its React presentation.
      const previousVisible =
        previous?.generation === current.generation ? previous.visible : true;
      if (current.visible !== previousVisible) {
        runOnJS(publishVisibility)(current.generation, current.visible);
      }
    },
    [
      generation,
      publishVisibility,
      scrollY,
      tradeTop,
      tradeBottom,
      viewportHeight,
    ],
  );

  return currentSnapshot.visible;
};
