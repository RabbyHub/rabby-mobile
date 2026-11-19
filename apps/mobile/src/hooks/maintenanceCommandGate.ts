/**
 * Gate for non-production maintenance commands that arrive through debug deep
 * links.
 *
 * A link alone must never grant state / approval / biometric mutation
 * authority: the persisted Screen E2E session has to be armed locally from
 * Testkits → Dev switches on this device. Sensitive mutations additionally
 * require an unlocked wallet, and a command may carry its own expiry.
 */
export const SESSION_GATED_MAINTENANCE_COMMANDS = new Set([
  'debug-set-current-account',
  'debug-browser-tabs',
  'debug-biometrics',
  'debug-inject-approval',
  'debug-dapp-eval',
  'debug-set-clipboard',
  'debug-import-private-key',
  'debug-create-address',
  'debug-disconnect-dapp',
  'debug-capture-requests',
  'debug-open-modal',
]);

/** Sensitive mutations that additionally require an unlocked wallet. */
export const UNLOCKED_REQUIRED_MAINTENANCE_TYPES = new Set([
  'debug-set-current-account',
  'debug-browser-tabs',
  'debug-biometrics',
  'debug-inject-approval',
  'debug-dapp-eval',
  'debug-set-clipboard',
  'debug-disconnect-dapp',
]);

export type MaintenanceGateRejection =
  | 'session-disabled'
  | 'wallet-locked'
  | 'expired-command';

export type MaintenanceGateDecision =
  | { allowed: true }
  | { allowed: false; reason: MaintenanceGateRejection };

export type MaintenanceGateState = {
  /** Persisted Screen E2E session (Testkits → Dev switches). */
  sessionArmed: boolean;
  /** Keyring unlocked or a valid post-unlock session. */
  walletUnlocked: boolean;
  /** Optional per-command expiry (epoch ms) supplied by the caller. */
  expiresAt?: number | null;
  /** Injectable clock for tests. */
  now?: number;
};

export function evaluateMaintenanceGate(
  typeOrCommand: string,
  state: MaintenanceGateState,
): MaintenanceGateDecision {
  if (state.expiresAt != null) {
    const now = state.now ?? Date.now();
    if (!Number.isFinite(state.expiresAt) || state.expiresAt <= now) {
      return { allowed: false, reason: 'expired-command' };
    }
  }

  if (
    SESSION_GATED_MAINTENANCE_COMMANDS.has(typeOrCommand) &&
    !state.sessionArmed
  ) {
    return { allowed: false, reason: 'session-disabled' };
  }

  if (
    UNLOCKED_REQUIRED_MAINTENANCE_TYPES.has(typeOrCommand) &&
    !state.walletUnlocked
  ) {
    return { allowed: false, reason: 'wallet-locked' };
  }

  return { allowed: true };
}
