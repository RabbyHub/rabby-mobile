import React, { useEffect, useRef, type ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';

import {
  createStoreActivityScope,
  type StoreActivityScope,
} from '@/core/state/storeActivity';
import { registerStoreActivityScope } from '@/core/state/storeActivityDiagnostics';
import { StoreActivityProvider } from './StoreActivityProvider';

type StoreActivityNavigation = {
  isFocused: () => boolean;
  addListener: (event: 'focus' | 'blur', listener: () => void) => () => void;
};

type ScreenStoreActivityProviderProps = {
  children: ReactNode;
  label: string;
};

export function ScreenStoreActivityProvider({
  children,
  label,
}: ScreenStoreActivityProviderProps) {
  const navigation = useNavigation() as StoreActivityNavigation;
  const scopeRef = useRef<StoreActivityScope | null>(null);

  if (!scopeRef.current) {
    scopeRef.current = createStoreActivityScope({
      active: navigation.isFocused(),
      label,
    });
  }

  const scope = scopeRef.current;

  useEffect(() => {
    scope.setActive(navigation.isFocused());
    const unsubscribeFocus = navigation.addListener('focus', () => {
      scope.setActive(true);
    });
    const unsubscribeBlur = navigation.addListener('blur', () => {
      scope.setActive(false);
    });

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
    };
  }, [navigation, scope]);

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
