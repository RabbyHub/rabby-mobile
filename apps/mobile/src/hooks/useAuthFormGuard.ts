import { useEffect, useMemo, useRef } from 'react';

type FormValues = Record<string, string | number | boolean | null | undefined>;
type AuthTransaction = {
  from: string;
  to: string;
  data: string;
  value: string;
  chainId: number;
};

/** Bind the reviewed operation, without invalidating auth for gas refreshes. */
export function getAuthTransactionKey<T extends AuthTransaction>(
  txs: readonly T[],
) {
  return JSON.stringify(
    txs.map(({ from, to, data, value, chainId }) => ({
      from,
      to,
      data,
      value,
      chainId,
    })),
  );
}

type Attempt = {
  key: string;
  phase: 'auth' | 'dismissed' | 'submitting';
  invalidated: boolean;
};

/** Bind one authentication to the form the user reviewed, not a stale callback. */
export function useAuthFormGuard(values: FormValues, onChanged: () => void) {
  // Exact scalar equality is intentional: IDs must not be compared as numbers.
  const key = JSON.stringify(values);
  const latest = useRef({ key, onChanged });
  latest.current = { key, onChanged };
  const active = useRef<Attempt | null>(null);
  const mounted = useRef(true);
  if (active.current && active.current.key !== key) {
    active.current.invalidated = true;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current = null;
    };
  }, []);

  return useMemo(() => {
    let attempt: Attempt | null = null;
    return {
      onBeforeAuth() {
        if (active.current?.phase === 'submitting') {
          return;
        }
        attempt = {
          key,
          phase: 'auth',
          invalidated: latest.current.key !== key,
        };
        active.current = attempt;
      },
      onCancel() {
        if (active.current === attempt) {
          active.current = null;
        }
        attempt = null;
      },
      onAuthModalDismiss() {
        // iOS may dismiss before onFinished. Keep the snapshot for that callback.
        if (attempt?.phase === 'auth') {
          attempt.phase = 'dismissed';
        }
      },
      blockInput() {
        const pending = active.current;
        if (!pending) {
          return false;
        }
        if (pending.phase !== 'dismissed') {
          return true;
        }
        // A swipe dismissal need not call onCancel. Allow editing, but invalidate
        // synchronously, before React commits a queued input/token update.
        pending.invalidated = true;
        return false;
      },
      async onFinished(submit: () => unknown) {
        const pending = attempt;
        if (!mounted.current || !pending || active.current !== pending) {
          return;
        }
        attempt = null; // A repeated success callback must never submit twice.
        if (pending.invalidated || latest.current.key !== pending.key) {
          active.current = null;
          latest.current.onChanged();
          return;
        }
        pending.phase = 'submitting';
        try {
          return await submit();
        } finally {
          if (active.current === pending) {
            active.current = null;
          }
        }
      },
    };
  }, [key]);
}
