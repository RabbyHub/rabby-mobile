import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Result } from '@rabby-wallet/rabby-security-engine';
import type { ContextActionData } from '@rabby-wallet/rabby-security-engine/dist/rules';
import type { ActionRequireData } from '@rabby-wallet/rabby-action';
import * as apiSecurityEngine from '@/core/apis/securityEngine';
import {
  getActionSecurityGate,
  hasActionSecurityError,
} from '../components/SecurityEngine/actionSecurity';
import type { useApprovalSecurityEngine } from './useApprovalSecurityEngine';

export type PreparedSecurityActions<T> = {
  type: 'single' | 'multi';
  actions: {
    data: T;
    requireData: ActionRequireData;
    ctx: ContextActionData;
  }[];
};

/** One evaluation owns both the row verdicts and the approval's signing gate. */
export function useActionSecurity<T>(
  prepared: PreparedSecurityActions<T> | null,
  security: ReturnType<typeof useApprovalSecurityEngine>,
  mode: 'transaction' | 'typedData',
) {
  const { rules, userData, currentTx, getSnapshot, resetCurrentTx } = security;
  const scope = useId();
  const sequence = useRef(0);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    prepared: PreparedSecurityActions<T>;
    rules: typeof rules;
    userData: typeof userData;
    reload: number;
    version: number;
    results: Result[][];
  } | null>(null);
  const ready =
    !!evaluation &&
    evaluation.prepared === prepared &&
    evaluation.rules === rules &&
    evaluation.userData === userData &&
    evaluation.reload === reload &&
    evaluation.version === sequence.current;
  const groups = useMemo(
    () =>
      ready && evaluation
        ? evaluation.results.map((results, index) => ({
            scope: `${scope}:${evaluation.version}:${index}`,
            results,
          }))
        : [],
    [ready, evaluation, scope],
  );
  const gate = useMemo(
    () => getActionSecurityGate(groups, currentTx.processedRules, mode),
    [groups, currentTx.processedRules, mode],
  );
  const engineResults = useMemo(
    () => groups.flatMap(group => group.results),
    [groups],
  );
  const resultList = useMemo(
    () => groups.map(group => group.results),
    [groups],
  );
  const securityScopes = useMemo(
    () => groups.map(group => group.scope),
    [groups],
  );
  const latest = useRef({ ready, evaluation });
  latest.current = { ready, evaluation };

  const invalidate = useCallback(() => {
    sequence.current += 1;
    latest.current.ready = false;
    setEvaluation(null);
    setError(false);
  }, []);
  const retry = useCallback(() => {
    invalidate();
    setReload(value => value + 1);
  }, [invalidate]);

  // Keep this callback bound to the rendered evaluation. An old biometric or
  // hardware callback must not sign a newly evaluated transaction.
  const canSubmit = useCallback(() => {
    const current = getSnapshot();
    return (
      latest.current.ready &&
      latest.current.evaluation === evaluation &&
      !!evaluation &&
      evaluation.version === sequence.current &&
      current.rules === evaluation.rules &&
      current.userData === evaluation.userData &&
      !getActionSecurityGate(groups, current.currentTx.processedRules, mode)
        .hasUnProcessSecurityResult
    );
  }, [evaluation, getSnapshot, groups, mode]);

  useEffect(() => {
    const version = ++sequence.current;
    let cancelled = false;
    setEvaluation(null);
    setError(false);
    resetCurrentTx();
    if (!prepared) return;
    Promise.all(
      prepared.actions.map(action =>
        apiSecurityEngine.executeSecurityEngine(action.ctx),
      ),
    )
      .then(results => {
        if (cancelled || sequence.current !== version) return;
        if (hasActionSecurityError(results))
          throw new Error('Security evaluation failed');
        setEvaluation({ prepared, rules, userData, reload, version, results });
      })
      .catch(() => {
        if (!cancelled && sequence.current === version) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [prepared, rules, userData, reload, resetCurrentTx]);

  useEffect(
    () => () => {
      sequence.current += 1;
      latest.current.ready = false;
    },
    [],
  );

  return {
    ...gate,
    ready,
    error,
    engineResults,
    resultList,
    securityScopes,
    blocked: !ready || gate.hasUnProcessSecurityResult,
    invalidate,
    retry,
    canSubmit,
  };
}
