import { useEffect, useRef, useState } from 'react';

export type TokenListResourceStatus =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'ready'
  | 'error';

export type TokenListResourceState<T> = {
  requestKey: string;
  data: T[];
  error: unknown;
  status: TokenListResourceStatus;
};

type UseTokenListAsyncResourceOptions<T> = {
  enabled: boolean;
  requestKey: string;
  load: () => Promise<T[]>;
};

const EMPTY_TOKEN_LIST: never[] = [];

export class LatestAsyncRequest {
  private sequence = 0;

  next() {
    this.sequence += 1;
    return this.sequence;
  }

  invalidate() {
    this.sequence += 1;
  }

  isCurrent(requestId: number) {
    return requestId === this.sequence;
  }
}

export const makeTokenListRequestKey = (
  parts: ReadonlyArray<string | null | undefined>,
) => JSON.stringify(parts.map(part => part?.toLowerCase() || ''));

export const createTokenListResourceState = <
  T,
>(): TokenListResourceState<T> => ({
  requestKey: '',
  data: EMPTY_TOKEN_LIST,
  error: null,
  status: 'idle',
});

export const beginTokenListRequest = <T>(
  previous: TokenListResourceState<T>,
  requestKey: string,
): TokenListResourceState<T> => {
  if (previous.requestKey === requestKey && previous.status === 'ready') {
    return { ...previous, error: null, status: 'refreshing' };
  }
  return {
    requestKey,
    data: EMPTY_TOKEN_LIST,
    error: null,
    status: 'loading',
  };
};

export const resolveTokenListRequest = <T>(
  requestKey: string,
  data: T[],
): TokenListResourceState<T> => ({
  requestKey,
  data,
  error: null,
  status: 'ready',
});

export const failTokenListRequest = <T>(
  previous: TokenListResourceState<T>,
  requestKey: string,
  error: unknown,
): TokenListResourceState<T> => ({
  requestKey,
  data:
    previous.requestKey === requestKey
      ? previous.data
      : (EMPTY_TOKEN_LIST as T[]),
  error,
  status: 'error',
});

export const selectTokenListResource = <T>(
  state: TokenListResourceState<T>,
  enabled: boolean,
  requestKey: string,
) => {
  const isCurrentRequest = state.requestKey === requestKey;
  return {
    data: isCurrentRequest ? state.data : (EMPTY_TOKEN_LIST as T[]),
    error: isCurrentRequest ? state.error : null,
    isLoading: enabled && (!isCurrentRequest || state.status === 'loading'),
    isRefreshing: enabled && isCurrentRequest && state.status === 'refreshing',
    status: isCurrentRequest ? state.status : ('idle' as const),
  };
};

export const useTokenListAsyncResource = <T>({
  enabled,
  requestKey,
  load,
}: UseTokenListAsyncResourceOptions<T>) => {
  const [state, setState] = useState<TokenListResourceState<T>>(
    createTokenListResourceState,
  );
  const requestRef = useRef(new LatestAsyncRequest());

  useEffect(() => {
    if (!enabled || !requestKey) {
      requestRef.current.invalidate();
      return;
    }

    const requestId = requestRef.current.next();
    let active = true;

    setState(previous => beginTokenListRequest(previous, requestKey));

    load()
      .then(data => {
        if (!active || !requestRef.current.isCurrent(requestId)) {
          return;
        }
        setState(resolveTokenListRequest(requestKey, data));
      })
      .catch(error => {
        if (!active || !requestRef.current.isCurrent(requestId)) {
          return;
        }
        setState(previous => failTokenListRequest(previous, requestKey, error));
      });

    return () => {
      active = false;
    };
  }, [enabled, load, requestKey]);

  return selectTokenListResource(state, enabled, requestKey);
};
