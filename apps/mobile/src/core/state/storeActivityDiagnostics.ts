import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';
import type {
  StoreActivityScope,
  StoreActivityScopeDiagnostics,
} from './storeActivity';

export type StoreActivityDiagnosticsSnapshot = {
  enabled: boolean;
  scopes: StoreActivityScopeDiagnostics[];
};

type ScopeRegistration = {
  id: number;
  scope: StoreActivityScope;
};

const registrations = isNonProductionDiagnosticsEnabled
  ? new Map<number, ScopeRegistration>()
  : null;

let nextRegistrationId = 0;

export function registerStoreActivityScope(scope: StoreActivityScope) {
  if (!registrations) {
    return () => undefined;
  }

  const id = ++nextRegistrationId;
  registrations.set(id, { id, scope });

  return () => {
    registrations.delete(id);
  };
}

export function getStoreActivityDiagnosticsSnapshot(): StoreActivityDiagnosticsSnapshot {
  if (!registrations) {
    return {
      enabled: false,
      scopes: [],
    };
  }

  return {
    enabled: true,
    scopes: [...registrations.values()]
      .sort((left, right) => left.id - right.id)
      .map(registration => registration.scope.getDiagnostics()),
  };
}

export function getLatestStoreActivityScopeDiagnostics(label: string) {
  const scopes = getStoreActivityDiagnosticsSnapshot().scopes;

  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    if (scopes[index]?.label === label) {
      return scopes[index]!;
    }
  }

  return null;
}
