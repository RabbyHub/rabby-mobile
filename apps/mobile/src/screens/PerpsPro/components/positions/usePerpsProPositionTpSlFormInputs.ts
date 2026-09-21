import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';

import type { PerpsProPositionTpSlMode } from '@/core/services/perpsService';

import {
  calculatePositionTpSlEstimatedPnl,
  calculatePositionTpSlRoi,
  calculatePositionTpSlTriggerFromPnl,
  calculatePositionTpSlTriggerFromRoi,
  type PerpsPositionTpSlKind,
} from '../../model/positionTpSl';
import { sanitizePerpsProDecimalInput } from '../../model/trade';

type SideInputSource = 'mode' | 'trigger';

export type PerpsProPositionTpSlSideInputDraft = {
  mode: PerpsProPositionTpSlMode;
  rawMagnitude: string;
  source: SideInputSource;
  triggerPrice: string;
};

type SideInputCalculationContext = {
  direction: 'long' | 'short';
  entryPrice: string | null;
  kind: PerpsPositionTpSlKind;
  leverage: number;
  size: string | null;
  szDecimals: number;
};

const formatDerivedMagnitude = (value: string | null) => {
  const decimal = new BigNumber(value ?? Number.NaN);
  return decimal.isFinite()
    ? decimal.abs().decimalPlaces(2, BigNumber.ROUND_DOWN).toFixed()
    : '';
};

const calculateModeMagnitude = (
  mode: PerpsProPositionTpSlMode,
  triggerPrice: string,
  context: SideInputCalculationContext,
) => {
  if (!triggerPrice) {
    return '';
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
  mode: PerpsProPositionTpSlMode,
  rawMagnitude: string,
  context: SideInputCalculationContext,
) => {
  if (mode === 'pnl') {
    return (
      calculatePositionTpSlTriggerFromPnl({
        direction: context.direction,
        entryPrice: context.entryPrice,
        kind: context.kind,
        pnl: rawMagnitude,
        size: context.size || '',
        szDecimals: context.szDecimals,
      }) || ''
    );
  }
  return (
    calculatePositionTpSlTriggerFromRoi({
      direction: context.direction,
      entryPrice: context.entryPrice,
      kind: context.kind,
      leverage: context.leverage,
      roiPercent: rawMagnitude,
      szDecimals: context.szDecimals,
    }) || ''
  );
};

const createSideInputDraft = (
  mode: PerpsProPositionTpSlMode,
  triggerPrice: string,
  context: SideInputCalculationContext,
): PerpsProPositionTpSlSideInputDraft => ({
  mode,
  rawMagnitude: calculateModeMagnitude(mode, triggerPrice, context),
  source: 'trigger',
  triggerPrice,
});

const synchronizeSideInputDraft = (
  draft: PerpsProPositionTpSlSideInputDraft,
  context: SideInputCalculationContext,
  preferredMode: PerpsProPositionTpSlMode,
) => {
  const next =
    draft.source === 'trigger'
      ? {
          ...draft,
          mode: preferredMode,
          rawMagnitude: calculateModeMagnitude(
            preferredMode,
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
  preferredModes,
  sideSize,
  szDecimals,
}: {
  direction: 'long' | 'short';
  entryPrice: string | null;
  initialSize: string;
  initialStopLoss: string;
  initialTakeProfit: string;
  leverage: number;
  preferredModes: Record<'sl' | 'tp', PerpsProPositionTpSlMode>;
  sideSize: string | null;
  szDecimals: number;
}) => {
  const createContext = useCallback(
    (kind: PerpsPositionTpSlKind, size: string | null) => ({
      direction,
      entryPrice,
      kind,
      leverage,
      size,
      szDecimals,
    }),
    [direction, entryPrice, leverage, szDecimals],
  );
  const [takeProfit, setTakeProfit] = useState(() =>
    createSideInputDraft(
      preferredModes.tp,
      initialTakeProfit,
      createContext('takeProfit', initialSize),
    ),
  );
  const [stopLoss, setStopLoss] = useState(() =>
    createSideInputDraft(
      preferredModes.sl,
      initialStopLoss,
      createContext('stopLoss', initialSize),
    ),
  );

  useEffect(() => {
    setTakeProfit(current =>
      synchronizeSideInputDraft(
        current,
        createContext('takeProfit', sideSize),
        preferredModes.tp,
      ),
    );
    setStopLoss(current =>
      synchronizeSideInputDraft(
        current,
        createContext('stopLoss', sideSize),
        preferredModes.sl,
      ),
    );
  }, [createContext, preferredModes.sl, preferredModes.tp, sideSize]);

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
      const sanitized = sanitizePerpsProDecimalInput(next, 2);
      updateSide(kind, current => ({
        ...current,
        rawMagnitude: sanitized,
        source: 'mode',
        triggerPrice: calculateTriggerFromMode(
          current.mode,
          sanitized,
          createContext(kind, sideSize),
        ),
      }));
    },
    [createContext, sideSize, updateSide],
  );
  const selectMode = useCallback(
    (kind: PerpsPositionTpSlKind, nextMode: PerpsProPositionTpSlMode) => {
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
