const DEFAULT_FUNDING_LEDGER_POLL_DELAYS_MS = [
  2_000, 4_000, 8_000, 15_000,
] as const;

export const startPerpsFundingLedgerPolling = ({
  fetchLedger,
  pollDelaysMs = DEFAULT_FUNDING_LEDGER_POLL_DELAYS_MS,
  shouldContinue,
}: {
  fetchLedger: () => Promise<unknown>;
  pollDelaysMs?: readonly number[];
  shouldContinue: () => boolean;
}) => {
  let active = true;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const poll = async () => {
    await fetchLedger();
    if (!active || !shouldContinue() || pollDelaysMs.length === 0) {
      return;
    }
    const delay = pollDelaysMs[Math.min(attempt, pollDelaysMs.length - 1)];
    attempt += 1;
    timer = setTimeout(poll, delay);
  };

  void poll();
  return () => {
    active = false;
    if (timer) {
      clearTimeout(timer);
    }
  };
};
