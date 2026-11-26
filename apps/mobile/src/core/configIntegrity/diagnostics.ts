import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { getUserBehaviorTrackingOptOut } from '@/utils/trackingOptOut';
import {
  diagnosticReasons,
  hasOwn,
  registry,
  type Diagnostic,
  type DiagnosticReason,
  type ProtectedStore,
} from './schema';

export const CONFIG_INTEGRITY_EVENT = 'config-integrity';

function createEvent(tags: Record<string, unknown> | undefined) {
  const { reason, os, store, field } = tags ?? {};
  if (
    !diagnosticReasons.some(value => value === reason) ||
    (os !== 'ios' && os !== 'android') ||
    (store !== undefined &&
      (typeof store !== 'string' || !hasOwn(registry.stores, store))) ||
    (field !== undefined &&
      (typeof field !== 'string' ||
        typeof store !== 'string' ||
        !hasOwn(registry.stores[store as ProtectedStore], field)))
  ) {
    return null;
  }

  const validReason = reason as DiagnosticReason;
  switch (validReason) {
    case 'key_read_failed':
    case 'key_missing':
    case 'key_init_failed':
      if (store !== undefined) {
        return null;
      }
      break;
    case 'config_unreadable':
      if (store === undefined || field !== undefined) {
        return null;
      }
      break;
    case 'metadata_missing':
      if (field !== undefined) {
        return null;
      }
      break;
    case 'hmac_mismatch':
    case 'hmac_compute_failed':
      if (field === undefined) {
        return null;
      }
      break;
  }
  return {
    message: CONFIG_INTEGRITY_EVENT,
    level: 'warning' as const,
    tags: {
      reason: validReason,
      os,
      ...(typeof store === 'string' && { store }),
      ...(typeof field === 'string' && { field }),
    },
    fingerprint: [
      CONFIG_INTEGRITY_EVENT,
      validReason,
      ...(typeof store === 'string' ? [store] : []),
      ...(typeof field === 'string' ? [field] : []),
    ],
  };
}

export function reportConfigIntegrity(diagnostic: Diagnostic) {
  if (!getUserBehaviorTrackingOptOut()) {
    const event = createEvent({ ...diagnostic, os: Platform.OS });
    if (event) {
      Sentry.captureEvent(event);
    }
  }
}

export function sanitizeConfigIntegrityEvent(
  event: Parameters<typeof Sentry.captureEvent>[0],
) {
  const sanitized = createEvent(event.tags);
  return (
    sanitized && {
      ...sanitized,
      type: undefined,
      event_id: event.event_id,
      timestamp: event.timestamp,
      release: event.release,
      environment: event.environment,
    }
  );
}
