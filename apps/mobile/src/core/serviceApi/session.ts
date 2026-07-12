import type { SessionService } from '@/core/services/session';
import { getRegisteredService } from '@/core/services/serviceRegistry';
import {
  createDeferredServiceApi,
  registerLegacyCoreServiceLoader,
} from './createDeferredServiceApi';

export type SessionServiceApiContract = SessionService;

registerLegacyCoreServiceLoader('sessionService');

export const sessionServiceApi = createDeferredServiceApi<
  'sessionService',
  SessionServiceApiContract
>('sessionService');

function getSessionServiceSnapshot() {
  return getRegisteredService('sessionService');
}

function assertSessionServiceSnapshot() {
  const service = getRegisteredService('sessionService');
  if (!service) {
    throw new Error('sessionService is not ready');
  }
  return service;
}

export function getOrCreateSessionSync(
  ...args: Parameters<SessionService['getOrCreateSession']>
) {
  return assertSessionServiceSnapshot().getOrCreateSession(...args);
}

export function deleteSessionSync(
  ...args: Parameters<SessionService['deleteSession']>
) {
  const service = getSessionServiceSnapshot();
  if (service) {
    service.deleteSession(...args);
  }
}

export function broadcastSessionEventSync(
  ...args: Parameters<SessionService['broadcastEvent']>
) {
  const service = getSessionServiceSnapshot();
  if (service) {
    service.broadcastEvent(...args);
  }
}
