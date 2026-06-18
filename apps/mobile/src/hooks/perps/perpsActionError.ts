import { apisPerps } from '@/core/apis/perps';
import {
  perpsStore,
  setAccountNeedApproveAgent,
  setAccountNeedApproveBuilderFee,
} from '@/hooks/perps/usePerpsStore';
import { showToast } from '@/hooks/perps/showToast';
import { isWalletUnlockCancelled } from '@/utils/walletUnlockError';
import * as Sentry from '@sentry/react-native';

// Returns true when the error came from an expired agent. Side-effect: toast +
// flips `accountNeedApproveAgent`. Callers should treat true as "stop retrying".
export const judgeIsUserAgentIsExpired = async (
  errorMessage: string,
): Promise<boolean> => {
  const currentAccount = perpsStore.getState().currentPerpsAccount;
  const masterAddress = currentAccount?.address;
  if (!masterAddress) {
    return false;
  }
  // self-sign master signs its own orders — there is no agent to expire.
  if (apisPerps.isSelfSignPerpsAccount(currentAccount?.type)) {
    return false;
  }

  const agentWalletPreference = await apisPerps.getAgentWalletPreference(
    masterAddress,
  );
  const agentAddress = agentWalletPreference?.agentAddress;
  if (agentAddress && errorMessage.includes(agentAddress)) {
    console.warn('handle action agent is expired, logout');
    showToast('Agent is expired, please try again', 'error');
    setAccountNeedApproveAgent(true);
    return true;
  }
  return false;
};

// Hyperliquid rejects orders carrying a builder field when the user has not yet
// approved the builder fee, e.g. "Builder fee has not been approved."
const BUILDER_FEE_NOT_APPROVED_RE = /builder fee has not been approved/i;

// Returns true when the error came from an unapproved builder fee. Side-effect:
// toast + flips `accountNeedApproveBuilderFee`. Callers should treat true as
// "stop retrying".
export const judgeIsBuilderFeeNeedApprove = (errorMessage: string): boolean => {
  if (BUILDER_FEE_NOT_APPROVED_RE.test(errorMessage)) {
    console.warn('handle action builder fee is not approved');
    showToast('Builder fee has not been approved, please try again', 'error');
    setAccountNeedApproveBuilderFee(true);
    return true;
  }
  return false;
};

// User-cancelled signatures are not errors: never toast an error or hit Sentry
// for them. Covers the three cancel shapes the perps sign flow can produce:
//   - hardware mini-sign rethrows the string 'Canceled' (executeSignatures)
//   - local-wallet unlock / biometrics throw WalletUnlockCancelledError
export function isUserCancelledSignature(error: unknown): boolean {
  return error === 'Canceled' || isWalletUnlockCancelled(error);
}

type RunPerpsActionConfig<T> = {
  /** Value returned when an error is caught (after the side effects below). */
  fallback: T;
  /**
   * Short operation label, e.g. 'open position'. Drives the console / Sentry
   * message and the default toast text (`${label} error`).
   */
  label: string;
  /**
   * Override the user-facing toast. Defaults to
   * `error.message || `${label} error``. Pass a fixed string for flows that
   * should not surface the raw error (e.g. cancel / swap).
   */
  getToastMessage?: (error: any) => string;
  /** Extra serialisable context appended to the Sentry error, e.g. the params. */
  context?: unknown;
};

/**
 * Wraps a perps action so every handler shares one error path:
 *   1. swallow known, self-handled errors (expired agent / unapproved builder
 *      fee) — those already toast + flip their own approve flag;
 *   2. otherwise console + toast + Sentry, then return `fallback`.
 * Lets each handler declare only what differs (fallback / label / toast /
 * context) instead of repeating the catch block on every new action.
 */
export async function runPerpsAction<T>(
  config: RunPerpsActionConfig<T>,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (error: any) {
    if (isUserCancelledSignature(error)) {
      return config.fallback;
    }
    const message = error?.message || '';
    if (await judgeIsUserAgentIsExpired(message)) {
      return config.fallback;
    }
    if (judgeIsBuilderFeeNeedApprove(message)) {
      return config.fallback;
    }
    const title = `PERPS ${config.label} error`;
    console.error(title, error);
    showToast(
      config.getToastMessage?.(error) ??
        (error?.message || `${config.label} error`),
      'error',
    );
    Sentry.captureException(
      error instanceof Error ? error : new Error(String(error)),
      {
        extra: {
          title,
          context: config.context,
          rawError: error?.message ?? error,
        },
      },
    );
    return config.fallback;
  }
}
