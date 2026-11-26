import { useEffect, useRef } from 'react';

import { isNonPublicProductionEnv } from '@/constant';

type BizMockActionHookDefinition<Args extends unknown[]> = {
  /** Stable semantic key used by `action.invoke&id=...`. */
  id: string;
  /** Optional UI locator alias used by `action.invoke&testID=...`. */
  testID?: string;
  /** The same handler the real `onPress` uses. */
  handler: (...args: Args) => unknown;
};

/**
 * Registers a real business handler for biz-mock `action.invoke`.
 *
 * Returns the original handler unchanged, so the normal press path keeps its
 * exact identity and behaviour. In production the effect is a no-op and the
 * registry module is never loaded.
 */
export function useBizMockAction<Args extends unknown[]>(
  definition: BizMockActionHookDefinition<Args>,
) {
  const { id, testID } = definition;
  const handlerRef = useRef(definition.handler);
  handlerRef.current = definition.handler;

  useEffect(() => {
    if (!isNonPublicProductionEnv) {
      return;
    }

    let disposed = false;
    let unregister: (() => void) | undefined;

    void import('./actionRegistry')
      .then(module => {
        if (disposed) {
          return;
        }
        unregister = module.registerBizMockAction({
          id,
          testID,
          handler: payload =>
            handlerRef.current(...([payload] as unknown as Args)),
        });
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unregister?.();
    };
  }, [id, testID]);

  return definition.handler;
}
