import React, {
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';

import {
  createStoreActivityScope,
  type StoreActivityScope,
} from '@/core/state/storeActivity';
import { registerStoreActivityScope } from '@/core/state/storeActivityDiagnostics';
import { StoreActivityProvider } from './StoreActivityProvider';

type StoreActivityBoundaryProps = {
  active: boolean;
  children: ReactNode;
  label: string;
};

export function StoreActivityBoundary({
  active,
  children,
  label,
}: StoreActivityBoundaryProps) {
  const scopeRef = useRef<StoreActivityScope | null>(null);

  if (!scopeRef.current) {
    scopeRef.current = createStoreActivityScope({ active, label });
  }

  const scope = scopeRef.current;

  useLayoutEffect(() => {
    scope.setActive(active);
  }, [active, scope]);

  useEffect(() => {
    const unregisterDiagnostics = registerStoreActivityScope(scope);

    return () => {
      unregisterDiagnostics();
      scope.dispose();
    };
  }, [scope]);

  return (
    <StoreActivityProvider scope={scope}>{children}</StoreActivityProvider>
  );
}
