import contractCatalogJson from './serviceContractCatalog.json';
import type { CoreServiceName } from '@/core/services/serviceRegistry';

export type ServiceMethodSemantic =
  | 'query'
  | 'command'
  | 'subscription'
  | 'unknown';

export type CoreServiceContractDefinition = {
  apiModule: string | null;
  apiExport: string | null;
  access: 'deferred-api' | 'dependency-only';
  defaultReadiness: 'loaded';
  higherReadiness?: readonly 'runtimeReady'[];
  snapshotApi: boolean;
};

type CatalogServiceName = keyof typeof contractCatalogJson.services;
type MissingCatalogService = Exclude<CoreServiceName, CatalogServiceName>;
type UnexpectedCatalogService = Exclude<CatalogServiceName, CoreServiceName>;
type AssertNever<T extends never> = T;

export type ServiceContractCatalogMissingServices =
  AssertNever<MissingCatalogService>;
export type ServiceContractCatalogUnexpectedServices =
  AssertNever<UnexpectedCatalogService>;

export const coreServiceContractCatalog =
  contractCatalogJson.services as Record<
    CoreServiceName,
    CoreServiceContractDefinition
  >;

function matchesMethodPrefix(method: string, prefix: string) {
  if (method === prefix) {
    return true;
  }

  if (!method.startsWith(prefix)) {
    return false;
  }

  const nextCharacter = method[prefix.length];
  return nextCharacter === '_' || /[A-Z]/.test(nextCharacter || '');
}

export function getCoreServiceMethodSemantic(
  serviceName: CoreServiceName,
  method: string,
): ServiceMethodSemantic {
  const overrides = contractCatalogJson.methodOverrides as Partial<
    Record<CoreServiceName, Record<string, ServiceMethodSemantic>>
  >;
  const overridden = overrides[serviceName]?.[method];
  if (overridden) {
    return overridden;
  }

  const prefixes = contractCatalogJson.methodPrefixes;
  const orderedSemantics = ['subscription', 'query', 'command'] as const;

  for (const semantic of orderedSemantics) {
    if (
      prefixes[semantic].some(prefix => matchesMethodPrefix(method, prefix))
    ) {
      return semantic;
    }
  }

  return 'unknown';
}
