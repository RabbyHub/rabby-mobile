import { useCallback } from 'react';
import { Atom, WritableAtom } from 'jotai';
import { useAtomCallback } from 'jotai/utils';

import * as Sentry from '@sentry/react-native';

type RequestFunc = (...args: any) => any;
/**
 * @description pass one atom to indicate the request status, and one function to do the request,
 * in every level of app, the request is atomic, that means, wherever the request is called, only one request is allowed at the same time.
 *
 * it's designed to avoid the situation that the same request is called multiple times in a short time, which may cause some problems.
 */
export function useAtomicRequest<
  A extends WritableAtom<boolean, any, any>,
  T extends RequestFunc,
>(options: { isRequestingAtom: A; doRequest: T }) {
  const { isRequestingAtom, doRequest } = options;

  type FetchArgs = Parameters<T>;
  type FetchRet = ReturnType<T>;
  const fetchAction = useAtomCallback<FetchRet, FetchArgs>(
    useCallback(
      (get, set, ...args) => {
        const fetchingAccounts = get(isRequestingAtom);

        if (fetchingAccounts) return;
        set(isRequestingAtom, true);
        let result: any;
        try {
          result = doRequest(...args);
        } catch (error) {
          __DEV__ &&
            console.debug(
              `[useAtomicRequest::doRequest] ${doRequest.name}`,
              error,
            );
          Sentry.captureException(error);
        } finally {
          set(isRequestingAtom, false);
        }

        return result;
      },
      [
        doRequest,
        /* in fact, it wouldn't be changed, but it should be put here */
        isRequestingAtom,
      ],
    ),
  );

  return {
    fetchAction,
  };
}
