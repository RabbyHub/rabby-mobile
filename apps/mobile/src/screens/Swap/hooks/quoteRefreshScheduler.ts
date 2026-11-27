import { zCreate } from '@/core/utils/reexports';
import { getQuotePollingResumeDelay } from '@/utils/quotePolling';

type QuoteRefreshCountdown = {
  startedAt: number;
  deadline: number;
} | null;

type QuoteRefreshSession = {
  timer?: ReturnType<typeof setTimeout>;
  deadline: number | null;
  paused: boolean;
  onFire: () => void;
  shouldFire: () => boolean;
};

export const quoteRefreshCountdownStore = zCreate<{
  countdown: QuoteRefreshCountdown;
}>(() => ({ countdown: null }));

let currentSession: QuoteRefreshSession | null = null;

function stopTimer(session: QuoteRefreshSession) {
  if (session.timer) {
    clearTimeout(session.timer);
    session.timer = undefined;
  }
}

function fire(session: QuoteRefreshSession) {
  if (currentSession !== session) {
    return;
  }
  session.timer = undefined;
  if (session.paused) {
    return;
  }
  session.deadline = null;
  quoteRefreshCountdownStore.setState({ countdown: null });
  if (session.shouldFire()) {
    session.onFire();
  }
}

function arm(session: QuoteRefreshSession, delay: number) {
  stopTimer(session);
  session.timer = setTimeout(() => fire(session), delay);
}

function stopCurrentSession() {
  if (currentSession) {
    stopTimer(currentSession);
    currentSession = null;
  }
}

/**
 * Module-level owner for the quote auto-refresh timer. The React hook only
 * schedules/pauses it and subscribes to the published countdown; no timer or
 * periodic refresh state lives in a component.
 */
export function scheduleQuoteRefreshSession(input: {
  delay: number;
  paused: boolean;
  onFire: () => void;
  shouldFire: () => boolean;
}) {
  // Replace the running session without publishing an intermediate `null`
  // countdown: every publication re-renders every countdown subscriber.
  stopCurrentSession();
  const startedAt = Date.now();
  const session: QuoteRefreshSession = {
    deadline: startedAt + input.delay,
    paused: input.paused,
    onFire: input.onFire,
    shouldFire: input.shouldFire,
  };
  currentSession = session;
  quoteRefreshCountdownStore.setState({
    countdown: { startedAt, deadline: session.deadline! },
  });
  if (!session.paused) {
    arm(session, input.delay);
  }
}

export function pauseQuoteRefreshSession() {
  if (!currentSession) {
    return;
  }
  currentSession.paused = true;
  stopTimer(currentSession);
}

export function resumeQuoteRefreshSession() {
  const session = currentSession;
  if (!session) {
    return;
  }
  session.paused = false;
  const delay = getQuotePollingResumeDelay({ deadline: session.deadline });
  if (delay === null) {
    return;
  }
  if (delay <= 0) {
    fire(session);
    return;
  }
  arm(session, delay);
}

export function clearQuoteRefreshSession() {
  stopCurrentSession();
  const state = quoteRefreshCountdownStore.getState();
  if (state.countdown !== null) {
    quoteRefreshCountdownStore.setState({ countdown: null });
  }
}
