import {
  EmitterSubscription,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

import { logger } from '@/utils/logger';

export const RABBY_NATIVE_LOG_EVENT = 'RabbyNativeLog';

type NativeLogLevel = 'debug' | 'info' | 'warn' | 'error';

type NativeLogPayload = {
  level?: NativeLogLevel | string;
  module?: string;
  sourceLabel?: string;
  tag?: string;
  event?: string;
  message?: string;
  thread?: string;
  timestampMs?: number;
  elapsedRealtimeMs?: number;
  data?: Record<string, unknown>;
};

const activeSubscriptions = new Map<string, EmitterSubscription>();

function normalizeLevel(level: NativeLogPayload['level']): NativeLogLevel {
  switch (level) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return level;
    default:
      return 'info';
  }
}

function getLoggerMethod(level: NativeLogLevel) {
  const candidate = logger[level as keyof typeof logger];

  return typeof candidate === 'function'
    ? candidate.bind(logger)
    : logger.info.bind(logger);
}

function logNativePayload(
  payload: NativeLogPayload,
  fallbackModuleName: string,
  fallbackSourceLabel?: string,
) {
  const level = normalizeLevel(payload?.level);
  const tag = payload?.tag || `Native:${payload?.module || fallbackModuleName}`;
  const event = payload?.event || payload?.message || 'native_log';
  const data = {
    ...(payload?.data || {}),
    nativeModule: payload?.module || fallbackModuleName,
    nativeSourceLabel: payload?.sourceLabel || fallbackSourceLabel,
    nativeThread: payload?.thread,
    nativeTimestampMs: payload?.timestampMs,
    nativeElapsedRealtimeMs: payload?.elapsedRealtimeMs,
  };

  getLoggerMethod(level)(`[${tag}] ${event}`, data);
}

export function bindNativeLoggerBridge({
  nativeModuleName,
  sourceLabel,
  eventName = RABBY_NATIVE_LOG_EVENT,
}: {
  nativeModuleName: string;
  sourceLabel?: string;
  eventName?: string;
}) {
  if (Platform.OS !== 'android') {
    return;
  }

  const subscriptionKey = `${nativeModuleName}:${eventName}`;
  if (activeSubscriptions.has(subscriptionKey)) {
    return;
  }

  const nativeModule = (NativeModules as Record<string, unknown>)[
    nativeModuleName
  ];
  if (
    !nativeModule ||
    typeof NativeEventEmitter !== 'function' ||
    typeof (nativeModule as { addListener?: unknown }).addListener !==
      'function' ||
    typeof (nativeModule as { removeListeners?: unknown }).removeListeners !==
      'function'
  ) {
    return;
  }

  try {
    const eventEmitter = new NativeEventEmitter(nativeModule as any);
    const subscription = eventEmitter.addListener(
      eventName,
      (payload: NativeLogPayload) => {
        logNativePayload(payload, nativeModuleName, sourceLabel);
      },
    );

    activeSubscriptions.set(subscriptionKey, subscription);
  } catch (error) {
    logger.warn('[nativeLogger] failed to bind native logger bridge', {
      nativeModuleName,
      eventName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
