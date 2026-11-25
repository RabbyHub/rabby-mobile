import type { SelectedBridgeQuote } from '../types';

/**
 * Mock switches for the bridge quote/approve decoupling prototype.
 *
 * The Bridge screen only publishes a quote after `getBridgeQuoteApproval`
 * (an ERC20 allowance RPC) resolves, so the approve slot (shimmer / lock /
 * failure + retry) can only be inspected by mocking that step.
 *
 * Every switch below is **off by default** — with all of them off the screen
 * runs the exact production path. Flip only the one you need while debugging.
 *
 * - approval group: replaces the real allowance check and publishes the quote
 *   before the mocked result arrives (the decoupling prototype itself);
 * - demo group: pure navigation/scaffolding helpers, not part of the product
 *   behaviour. They are separate so the approval mock can be inspected without
 *   silently typing or tapping on the user's behalf.
 *
 * All of them are no-ops outside `__DEV__`.
 */
export const BRIDGE_MOCK_SWITCHES = {
  approval: {
    /** Master switch of the approval mock (quote published before the result). */
    enabled: false,
    /** Mocked result: the token needs an approve step (lock icon). */
    needApprove: false,
    /** Every quote's allowance check fails → there is nothing to fall back to. */
    failAll: false,
    /** Only the first quote of a cycle fails → the selector can fall back. */
    failOne: false,
    /**
     * Only meaningful with `failAll` / `failOne`: let the retry succeed (`needApprove`)
     * instead of failing again, so the success state can be inspected.
     */
    failOnce: false,
    /**
     * Demo only. When on, a failed quote is kept visible with the orange
     * banner/retry instead of being dropped. Real behaviour (default) treats a
     * failed quote exactly like a quote that never arrived.
     */
    keepFailedQuote: false,
  },
  demo: {
    /** Auto-fill `0.0001` so the quote step is reached without typing. */
    autoFillAmount: false,
    /** Auto-open the quote list to inspect the item-level approve slot. */
    autoOpenQuoteList: false,
    /** Tap the banner Retry automatically 2s after a kept failure shows up. */
    autoRetryFailedQuote: false,
  },
};

/** Delay before the first mocked approval result lands. */
export const BRIDGE_APPROVAL_MOCK_DELAY_MS = 1500;

/** Delay used by the retry action so the shimmer can be seen again. */
export const BRIDGE_APPROVAL_MOCK_RETRY_DELAY_MS = 1200;

/** Auto-fill value used by `demo.autoFillAmount`. */
export const BRIDGE_APPROVAL_MOCK_AMOUNT = '0.0001';

/** Delay before `demo.autoFillAmount` fills the amount. */
export const BRIDGE_APPROVAL_MOCK_AUTOFILL_DELAY_MS = 4000;

/** Delay before `demo.autoOpenQuoteList` opens the list. */
export const BRIDGE_APPROVAL_MOCK_AUTOOPEN_DELAY_MS = 30000;

export type BridgeApprovalMockResult = Pick<
  SelectedBridgeQuote,
  'shouldApproveToken' | 'shouldTwoStepApprove'
>;

export const isBridgeApprovalMockEnabled = () =>
  __DEV__ && BRIDGE_MOCK_SWITCHES.approval.enabled;

const delay = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

/** Quote key that `failOne` picked for the current cycle. */
let failOneTargetKey: string | undefined;

/** Called once per quote cycle so `failOne` picks the first quote again. */
export function resetMockBridgeApprovalCycle() {
  failOneTargetKey = undefined;
}

/**
 * Mimics `getBridgeQuoteApproval`: resolves with the approve flags or throws.
 * `isRetry` is used by the retry action, which only succeeds when
 * `failOnce` is on.
 */
export async function getMockBridgeQuoteApproval({
  isRetry = false,
  quoteKey = '',
}: {
  isRetry?: boolean;
  quoteKey?: string;
} = {}): Promise<BridgeApprovalMockResult> {
  const switches = BRIDGE_MOCK_SWITCHES.approval;
  await delay(
    isRetry
      ? BRIDGE_APPROVAL_MOCK_RETRY_DELAY_MS
      : BRIDGE_APPROVAL_MOCK_DELAY_MS,
  );

  if (!__DEV__ || !switches.enabled) {
    throw new Error('[bridge-approval-mock] mock is off');
  }

  let shouldFail = switches.failAll;
  if (!shouldFail && switches.failOne) {
    if (!failOneTargetKey) {
      failOneTargetKey = quoteKey;
    }
    shouldFail = failOneTargetKey === quoteKey;
  }

  if (shouldFail && !(isRetry && switches.failOnce)) {
    throw new Error('[bridge-approval-mock] mocked approval failure');
  }

  return {
    shouldApproveToken: switches.needApprove,
    shouldTwoStepApprove: false,
  };
}
