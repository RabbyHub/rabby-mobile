import { appStorage } from '@/core/storage/mmkv';
import { APP_MMKV_WEAK_KEYS } from '@/core/storage/mmkvConstants';
import {
  WALLETCONNECT_AUTO_DISCONNECT_DEFAULT_INACTIVE_MINUTES,
  WalletConnectAutoDisconnect,
} from './constants';

type WalletConnectSettings = {
  autoDisconnect: {
    enabled: boolean;
    inactiveMinutes: number;
  };
};

const MAX_SET_TIMEOUT_MS = 2_147_483_647;

const DEFAULT_WALLETCONNECT_SETTINGS: WalletConnectSettings = {
  autoDisconnect: {
    enabled: WalletConnectAutoDisconnect,
    inactiveMinutes: WALLETCONNECT_AUTO_DISCONNECT_DEFAULT_INACTIVE_MINUTES,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidInactiveMinutes(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0 &&
    value * 60 * 1000 <= MAX_SET_TIMEOUT_MS
  );
}

function normalizeWalletConnectSettings(raw: unknown): WalletConnectSettings {
  const settings = isRecord(raw) ? raw : {};
  const autoDisconnect = isRecord(settings.autoDisconnect)
    ? settings.autoDisconnect
    : {};
  const defaults = DEFAULT_WALLETCONNECT_SETTINGS.autoDisconnect;

  return {
    autoDisconnect: {
      enabled:
        typeof autoDisconnect.enabled === 'boolean'
          ? autoDisconnect.enabled
          : defaults.enabled,
      inactiveMinutes: isValidInactiveMinutes(autoDisconnect.inactiveMinutes)
        ? autoDisconnect.inactiveMinutes
        : defaults.inactiveMinutes,
    },
  };
}

export function getWalletConnectSettings() {
  return normalizeWalletConnectSettings(
    appStorage.getItem(APP_MMKV_WEAK_KEYS.WALLETCONNECT_SETTINGS),
  );
}

function setWalletConnectAutoDisconnectSettings(
  patch: Partial<WalletConnectSettings['autoDisconnect']>,
) {
  const current = getWalletConnectSettings();
  const next = {
    ...current,
    autoDisconnect: {
      ...current.autoDisconnect,
      ...patch,
    },
  };
  appStorage.setItem(APP_MMKV_WEAK_KEYS.WALLETCONNECT_SETTINGS, next);
  return next;
}

export function getWalletConnectAutoDisconnectEnabled() {
  return getWalletConnectSettings().autoDisconnect.enabled;
}

export function setWalletConnectAutoDisconnectEnabled(enabled: boolean) {
  return setWalletConnectAutoDisconnectSettings({ enabled });
}

export function getWalletConnectAutoDisconnectInactiveMinutes() {
  return getWalletConnectSettings().autoDisconnect.inactiveMinutes;
}

export function setWalletConnectAutoDisconnectInactiveMinutes(minutes: number) {
  if (!isValidInactiveMinutes(minutes)) {
    throw new Error(
      'WalletConnect auto-disconnect expiry must be greater than 0 minutes.',
    );
  }

  return setWalletConnectAutoDisconnectSettings({ inactiveMinutes: minutes });
}
