import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { useCallback, useEffect, useRef } from 'react';

import { isNonPublicProductionEnv } from '@/constant';

import type { BizMockModalKind } from './modalRegistry';

type BizMockModalRegistrationOptions = {
  kind?: BizMockModalKind;
  id?: string;
  name?: string;
  testID?: string;
};

type ModalRegistryModule = typeof import('./modalRegistry');

export function useBizMockModalRegistration(
  options: BizMockModalRegistrationOptions,
) {
  const { kind, id, name, testID } = options;
  const instanceRef = useRef<BottomSheetModalMethods | null>(null);
  const activeRef = useRef(false);
  const registryIdRef = useRef<string | null>(null);
  const registryRef = useRef<ModalRegistryModule | null>(null);
  const unregisterRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isNonPublicProductionEnv) {
      return;
    }

    let disposed = false;
    void import('./modalRegistry')
      .then(module => {
        if (disposed) {
          return;
        }
        registryRef.current = module;
        const registered = module.registerBizMockModal({
          kind,
          id,
          name,
          testID,
          active: activeRef.current,
          instance: instanceRef.current,
        });
        registryIdRef.current = registered.registryId;
        unregisterRef.current = registered.unregister;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      unregisterRef.current?.();
      unregisterRef.current = null;
      registryIdRef.current = null;
      registryRef.current = null;
    };
  }, [kind, id, name, testID]);

  const setInstance = useCallback(
    (instance: BottomSheetModalMethods | null) => {
      instanceRef.current = instance;
      const registryId = registryIdRef.current;
      if (registryId) {
        registryRef.current?.updateBizMockModalInstance(registryId, instance);
      }
    },
    [],
  );

  const setActive = useCallback((active: boolean) => {
    activeRef.current = active;
    const registryId = registryIdRef.current;
    if (registryId) {
      registryRef.current?.setBizMockModalActive(registryId, active);
    }
  }, []);

  const markDismissed = useCallback(() => {
    setActive(false);
  }, [setActive]);

  return {
    setInstance,
    setActive,
    markDismissed,
  };
}
