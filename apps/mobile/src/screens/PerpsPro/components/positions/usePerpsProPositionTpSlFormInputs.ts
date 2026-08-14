import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';

import {
  calculatePositionTpSlEstimatedPnl,
  calculatePositionTpSlRoi,
  calculatePositionTpSlTriggerFromPnl,
  calculatePositionTpSlTriggerFromRoi,
  type PerpsPositionTpSlKind,
} from '../../model/positionTpSl';
import type { PerpsProTpSlMode } from '../../model/tpsl';

type SideInputSource = 'mode' | 'trigger';

export type PerpsProPositionTpSlSideInputDraft = {
  mode: PerpsProTpSlMode;
  rawMagnitude: string;
  source: SideInputSource;
  triggerPrice: string;
};

type SideInputCalculationContext = {
  direction: 'long' | 'short';
  entryPrice: string | null;
  kind: PerpsPositionTpSlKind;
  leverage: number;
  pxDecimals: number;
  size: string | null;
};

const formatDerivedMagnitude = (value: string | null) => {
  const decimal = new BigNumber(value ?? Number.NaN);
  return decimal.isFinite()
    ? decimal.abs().decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed()
    : '';
};

const calculateModeMagnitude = (
  mode: PerpsProTpSlMode,
  triggerPrice: string,
  context: SideInputCalculationContext,
) => {
  if (!triggerPrice) {
    return '';
  }
  if (mode === 'price') {
    return triggerPrice;
  }
  if (mode === 'pnl') {
    return formatDerivedMagnitude(
      calculatePositionTpSlEstimatedPnl({
        direction: context.direction,
        entryPrice: context.entryPrice,
        size: context.size || '',
        triggerPrice,
      }),
    );
  }
  return formatDerivedMagnitude(
    calculatePositionTpSlRoi({
      direction: context.direction,
      entryPrice: context.entryPrice,
      leverage: context.leverage,
      triggerPrice,
    }),
  );
};

const calculateTriggerFromMode = (
  mode: PerpsProTpSlMode,
  rawMagnitude: string,
  context: SideInputCalculationContext,
) => {
  if (mode === 'price') {
    return rawMagnitude;
  }
  if (mode === 'pnl') {
    return (
      calculatePositionTpSlTriggerFromPnl({
        direction: context.direction,
        entryPrice: context.entryPrice,
        kind: context.kind,
        pnl: rawMagnitude,
        pxDecimals: context.pxDecimals,
        size: context.size || '',
      }) || ''
    );
  }
  return (
    calculatePositionTpSlTriggerFromRoi({
      direction: context.direction,
      entryPrice: context.entryPrice,
      kind: context.kind,
      leverage: context.leverage,
      pxDecimals: context.pxDecimals,
      roiPercent: rawMagnitude,
    }) || ''
  );
};

const createSideInputDraft = (
  triggerPrice: string,
  context: SideInputCalculationContext,
): PerpsProPositionTpSlSideInputDraft => ({
  mode: 'roi',
  rawMagnitude: calculateModeMagnitude('roi', triggerPrice, context),
  source: 'trigger',
  triggerPrice,
});

const synchronizeSideInputDraft = (
  draft: PerpsProPositionTpSlSideInputDraft,
  context: SideInputCalculationContext,
) => {
  const next =
    draft.source === 'trigger'
      ? {
          ...draft,
          rawMagnitude: calculateModeMagnitude(
            draft.mode,
            draft.triggerPrice,
            context,
          ),
        }
      : {
          ...draft,
          triggerPrice: calculateTriggerFromMode(
            draft.mode,
            draft.rawMagnitude,
            context,
          ),
        };
  return next.rawMagnitude === draft.rawMagnitude &&
    next.triggerPrice === draft.triggerPrice
    ? draft
    : next;
};

export const usePerpsProPositionTpSlFormInputs = ({
  direction,
  entryPrice,
  initialSize,
  initialStopLoss,
  initialTakeProfit,
  leverage,
  pxDecimals,
  sideSize,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  initialSize: string;
  initialStopLoss: string;
  initialTakeProfit: string;
  leverage: number;
  pxDecimals: number;
  sideSize: string | null;
}) => {
  const createContext = useCallback(
    (kind: PerpsPositionTpSlKind, size: string | null) => ({
      direction,
      entryPrice,
      kind,
      leverage,
      pxDecimals,
      size,
    }),
    [direction, entryPrice, leverage, pxDecimals],
  );
  const [takeProfit, setTakeProfit] = useState(() =>
    createSideInputDraft(
      initialTakeProfit,
      createContext('takeProfit', initialSize),
    ),
  );
  const [stopLoss, setStopLoss] = useState(() =>
    createSideInputDraft(
      initialStopLoss,
      createContext('stopLoss', initialSize),
    ),
  );

  useEffect(() => {
    setTakeProfit(current =>
      synchronizeSideInputDraft(current, createContext('takeProfit', sideSize)),
    );
    setStopLoss(current =>
      synchronizeSideInputDraft(current, createContext('stopLoss', sideSize)),
    );
  }, [createContext, sideSize]);

  const updateSide = useCallback(
    (
      kind: PerpsPositionTpSlKind,
      update: (
        current: PerpsProPositionTpSlSideInputDraft,
      ) => PerpsProPositionTpSlSideInputDraft,
    ) => {
      (kind === 'takeProfit' ? setTakeProfit : setStopLoss)(update);
    },
    [],
  );
  const changeTrigger = useCallback(
    (kind: PerpsPositionTpSlKind, next: string) => {
      updateSide(kind, current => ({
        ...current,
        rawMagnitude: calculateModeMagnitude(
          current.mode,
          next,
          createContext(kind, sideSize),
        ),
        source: 'trigger',
        triggerPrice: next,
      }));
    },
    [createContext, sideSize, updateSide],
  );
  const changeModeMagnitude = useCallback(
    (kind: PerpsPositionTpSlKind, next: string) => {
      updateSide(kind, current => ({
        ...current,
        rawMagnitude: next,
        source: 'mode',
        triggerPrice: calculateTriggerFromMode(
          current.mode,
          next,
          createContext(kind, sideSize),
        ),
      }));
    },
    [createContext, sideSize, updateSide],
  );
  const selectMode = useCallback(
    (kind: PerpsPositionTpSlKind, nextMode: PerpsProTpSlMode) => {
      updateSide(kind, current =>
        current.mode === nextMode
          ? current
          : {
              mode: nextMode,
              rawMagnitude: '',
              source: 'mode',
              triggerPrice: '',
            },
      );
    },
    [updateSide],
  );

  return {
    changeModeMagnitude,
    changeTrigger,
    selectMode,
    stopLoss,
    takeProfit,
  };
};
