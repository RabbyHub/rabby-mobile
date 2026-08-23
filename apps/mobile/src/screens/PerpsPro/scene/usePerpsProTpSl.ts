import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getPerpsProAttachedTpSlCompatibilityError,
  previewPerpsProTpSlLeg,
  type PerpsProAttachedTpSlDraft,
  type PerpsProEvaluatedTpSlLeg,
  type PerpsProTpSlLegKind,
  type PerpsProTpSlMode,
} from '../model/tpsl';
import { sanitizePerpsProDecimalInput } from '../model/trade';

export type PerpsProTpSlPreviewFacts = {
  baseSize: string;
  expectedEntryPrice: string;
};

export type PerpsProTpSlDirectionPreview = {
  sl: PerpsProEvaluatedTpSlLeg | null;
  tp: PerpsProEvaluatedTpSlLeg | null;
};

const emptyPreview: PerpsProTpSlDirectionPreview = { sl: null, tp: null };

export const clearPerpsProTpSlForMarketChange = (
  draft: PerpsProAttachedTpSlDraft,
): PerpsProAttachedTpSlDraft => ({
  enabled: false,
  sl: { mode: draft.sl.mode, rawMagnitude: '' },
  tp: { mode: draft.tp.mode, rawMagnitude: '' },
});

export const usePerpsProTpSl = ({
  draft,
  leverage,
  onChange,
  order,
  pxDecimals,
  previewFacts,
  szDecimals,
}: {
  draft: PerpsProAttachedTpSlDraft;
  leverage: number;
  onChange: (draft: PerpsProAttachedTpSlDraft) => void;
  order: {
    bboEnabled: boolean;
    orderType: 'conditional' | 'limit' | 'market';
    reduceOnly: boolean;
    tif: 'Alo' | 'Gtc' | 'Ioc';
  };
  pxDecimals: number;
  previewFacts: Record<'buy' | 'sell', PerpsProTpSlPreviewFacts | null>;
  szDecimals: number;
}) => {
  const [focusedLeg, setFocusedLeg] = useState<PerpsProTpSlLegKind | null>(
    null,
  );
  const compatibilityError = getPerpsProAttachedTpSlCompatibilityError(order);
  const blockingCompatibilityError =
    compatibilityError === 'bboUnsupported' ? null : compatibilityError;

  useEffect(() => {
    if (!compatibilityError || !draft.enabled) return;
    onChange({ ...draft, enabled: false });
    setFocusedLeg(null);
  }, [compatibilityError, draft, onChange]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && blockingCompatibilityError) return;
      onChange({ ...draft, enabled });
      if (!enabled) setFocusedLeg(null);
    },
    [blockingCompatibilityError, draft, onChange],
  );

  const setMode = useCallback(
    (kind: PerpsProTpSlLegKind, mode: PerpsProTpSlMode) => {
      if (draft[kind].mode !== mode) {
        onChange({
          ...draft,
          [kind]: { mode, rawMagnitude: '' },
        });
      }
    },
    [draft, onChange],
  );

  const setRawMagnitude = useCallback(
    (kind: PerpsProTpSlLegKind, value: string) => {
      const maxDecimals = draft[kind].mode === 'price' ? pxDecimals : 8;
      onChange({
        ...draft,
        [kind]: {
          ...draft[kind],
          rawMagnitude: sanitizePerpsProDecimalInput(value, maxDecimals),
        },
      });
    },
    [draft, onChange, pxDecimals],
  );

  const previews = useMemo(() => {
    const buildDirection = (
      side: 'buy' | 'sell',
    ): PerpsProTpSlDirectionPreview => {
      const facts = previewFacts[side];
      if (!facts) return emptyPreview;
      return {
        sl: previewPerpsProTpSlLeg({
          ...facts,
          draft: draft.sl,
          kind: 'sl',
          leverage,
          side,
          szDecimals,
        }),
        tp: previewPerpsProTpSlLeg({
          ...facts,
          draft: draft.tp,
          kind: 'tp',
          leverage,
          side,
          szDecimals,
        }),
      };
    };
    return { buy: buildDirection('buy'), sell: buildDirection('sell') };
  }, [draft.sl, draft.tp, leverage, previewFacts, szDecimals]);

  const clearForMarketChange = useCallback(() => {
    onChange(clearPerpsProTpSlForMarketChange(draft));
    setFocusedLeg(null);
  }, [draft, onChange]);

  return {
    clearForMarketChange,
    compatibilityError,
    disabled: blockingCompatibilityError != null,
    focusedLeg,
    previews,
    setEnabled,
    setFocusedLeg,
    setMode,
    setRawMagnitude,
  };
};

export type PerpsProTpSlController = ReturnType<typeof usePerpsProTpSl>;
