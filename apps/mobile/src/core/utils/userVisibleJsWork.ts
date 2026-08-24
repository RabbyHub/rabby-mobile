type UserVisibleJsWorkWaiter = {
  id: number;
  callback: () => void;
  quietMs: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

export type UserVisibleJsWorkSnapshot = {
  activeCount: number;
  labels: string[];
  lastSettledAt: number;
};

const activeWork = new Map<number, string>();
const waiters = new Map<number, UserVisibleJsWorkWaiter>();

let workSequence = 0;
let waiterSequence = 0;
let lastSettledAt = 0;

const clearWaiterTimer = (waiter: UserVisibleJsWorkWaiter) => {
  if (waiter.timeoutId === null) {
    return;
  }
  clearTimeout(waiter.timeoutId);
  waiter.timeoutId = null;
};

const scheduleWaiter = (waiter: UserVisibleJsWorkWaiter) => {
  clearWaiterTimer(waiter);
  if (!waiters.has(waiter.id) || activeWork.size > 0) {
    return;
  }

  const elapsedSinceSettled = lastSettledAt
    ? Math.max(0, Date.now() - lastSettledAt)
    : Number.POSITIVE_INFINITY;
  const delayMs = Math.max(0, waiter.quietMs - elapsedSinceSettled);
  waiter.timeoutId = setTimeout(() => {
    waiter.timeoutId = null;
    if (!waiters.has(waiter.id) || activeWork.size > 0) {
      return;
    }
    waiters.delete(waiter.id);
    waiter.callback();
  }, delayMs);
};

const rescheduleWaiters = () => {
  waiters.forEach(scheduleWaiter);
};

/**
 * Marks JS work whose result is currently visible to the user. This is a
 * scheduling signal only; it never changes or serializes the work itself.
 */
export const beginUserVisibleJsWork = (label: string) => {
  const workId = ++workSequence;
  activeWork.set(workId, label);
  waiters.forEach(clearWaiterTimer);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    activeWork.delete(workId);
    if (activeWork.size === 0) {
      lastSettledAt = Date.now();
      rescheduleWaiters();
    }
  };
};

/**
 * Defers a low-priority callback until visible JS work has settled. A new
 * visible task during the quiet window restarts that window.
 */
export const runAfterUserVisibleJsWorkSettles = (
  callback: () => void,
  options: { quietMs?: number } = {},
) => {
  const waiter: UserVisibleJsWorkWaiter = {
    id: ++waiterSequence,
    callback,
    quietMs: Math.max(0, options.quietMs ?? 0),
    timeoutId: null,
  };
  waiters.set(waiter.id, waiter);
  scheduleWaiter(waiter);

  return () => {
    clearWaiterTimer(waiter);
    waiters.delete(waiter.id);
  };
};

export const getUserVisibleJsWorkSnapshot = (): UserVisibleJsWorkSnapshot => ({
  activeCount: activeWork.size,
  labels: Array.from(activeWork.values()),
  lastSettledAt,
});
