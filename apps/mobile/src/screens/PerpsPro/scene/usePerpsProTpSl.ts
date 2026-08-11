import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getPerpsProAttachedTpSlCompatibilityError,
  previewPerpsProTpSlLeg,
  type PerpsProAttachedTpSlDraft,
  type PerpsProEvaluatedTpSlLeg,
  type PerpsProTpSlLegKind,
  type PerpsProTpSlMode,
  type PerpsProTpSlValidationError,
} from '../model/tpsl';
import { sanitizePerpsProDecimalInput } from '../model/trade';
import type { PerpsProTpSlErrorContext } from '../utils/tpSlError';

export type PerpsProTpSlPreviewFacts = {
  baseSize: string;
  expectedEntryPrice: string;
};

export type PerpsProTpSlDirectionPreview = {
  sl: PerpsProEvaluatedTpSlLeg | null;
  tp: PerpsProEvaluatedTpSlLeg | null;
};

const emptyPreview: PerpsProTpSlDirectionPreview = { sl: null, tp: null };

export type PerpsProTpSlSubmitContext = PerpsProTpSlErrorContext;

const emptySubmitContext: PerpsProTpSlSubmitContext = {
  liquidationPrice: null,
  side: null,
};

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
  const [submitErrors, setSubmitErrorsState] = useState<
    PerpsProTpSlValidationError[]
  >([]);
  const [submitContext, setSubmitContext] =
    useState<PerpsProTpSlSubmitContext>(emptySubmitContext);
  const setSubmitErrors = useCallback(
    (
      errors: PerpsProTpSlValidationError[],
      context: PerpsProTpSlSubmitContext = emptySubmitContext,
    ) => {
      setSubmitErrorsState(errors);
      setSubmitContext(context);
    },
    [],
  );
  const compatibilityError = getPerpsProAttachedTpSlCompatibilityError(order);

  useEffect(() => {
    if (!compatibilityError || !draft.enabled) return;
    onChange({ ...draft, enabled: false });
    setFocusedLeg(null);
  }, [compatibilityError, draft, onChange]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled && compatibilityError) return;
      onChange({ ...draft, enabled });
      setSubmitErrors([]);
      if (!enabled) setFocusedLeg(null);
    },
    [compatibilityError, draft, onChange, setSubmitErrors],
  );

  const setMode = useCallback(
    (kind: PerpsProTpSlLegKind, mode: PerpsProTpSlMode) => {
      if (draft[kind].mode !== mode) {
        onChange({
          ...draft,
          [kind]: { mode, rawMagnitude: '' },
        });
      }
      setSubmitErrors([]);
    },
    [draft, onChange, setSubmitErrors],
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
      setSubmitErrors([]);
    },
    [draft, onChange, pxDecimals, setSubmitErrors],
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
    setSubmitErrors([]);
  }, [draft, onChange, setSubmitErrors]);

  return {
    clearForMarketChange,
    compatibilityError,
    disabled: compatibilityError != null,
    focusedLeg,
    previews,
    setEnabled,
    setFocusedLeg,
    setMode,
    setRawMagnitude,
    setSubmitErrors,
    submitContext,
    submitErrors,
  };
};

export type PerpsProTpSlController = ReturnType<typeof usePerpsProTpSl>;
