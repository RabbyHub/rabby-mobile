/**
 * Non-production action registry.
 *
 * Business components mount a stable semantic id next to their real onPress
 * handler through `useBizMockAction`. A biz-mock suite then calls
 * `action.invoke` to run that exact handler instead of synthesising a touch at
 * a screen coordinate.
 *
 * The registry is a plain module-level map with no subscriptions and no work
 * at import time. Nothing in production imports it: `useBizMockAction` loads
 * it through a guarded dynamic import, and `actions.ts` is itself only loaded
 * by the non-production deeplink listener.
 */

export type BizMockActionPayload = Record<string, unknown>;

export type BizMockActionHandler = (payload?: BizMockActionPayload) => unknown;

export type BizMockActionEntry = {
  id: string;
  testID?: string;
  handler: BizMockActionHandler;
};

export type BizMockActionResult =
  | {
      ok: true;
      code: 'ok';
      data: {
        id: string;
        testID: string | null;
        dispatched: boolean;
        timedOut: boolean;
      };
    }
  | { ok: false; code: string; message: string };

const entriesById = new Map<string, BizMockActionEntry>();
const idsByTestID = new Map<string, Set<string>>();

const MOUNT_POLL_INTERVAL_MS = 100;
const DEFAULT_MOUNT_TIMEOUT_MS = 3_000;
const MAX_MOUNT_TIMEOUT_MS = 10_000;
const HANDLER_TIMEOUT_MS = 4_000;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function normalize(value: string | undefined) {
  return (value || '').trim();
}

function detachTestID(id: string, testID?: string) {
  const key = normalize(testID);
  if (!key) {
    return;
  }
  const ids = idsByTestID.get(key);
  if (!ids) {
    return;
  }
  ids.delete(id);
  if (!ids.size) {
    idsByTestID.delete(key);
  }
}

export function registerBizMockAction(entry: BizMockActionEntry) {
  const id = normalize(entry.id);
  if (!id) {
    return () => undefined;
  }

  const registered: BizMockActionEntry = { ...entry, id };
  entriesById.set(id, registered);

  const testID = normalize(entry.testID);
  if (testID) {
    const ids = idsByTestID.get(testID) || new Set<string>();
    ids.add(id);
    idsByTestID.set(testID, ids);
  }

  return () => {
    if (entriesById.get(id) === registered) {
      entriesById.delete(id);
    }
    detachTestID(id, entry.testID);
  };
}

export function listBizMockActions() {
  return Array.from(entriesById.values()).map(entry => ({
    id: entry.id,
    testID: entry.testID || null,
  }));
}

export function findBizMockAction(query: { id?: string; testID?: string }) {
  const id = normalize(query.id);
  if (id) {
    const found = entriesById.get(id);
    if (found) {
      return found;
    }
  }

  const testID = normalize(query.testID);
  if (testID) {
    const ids = idsByTestID.get(testID);
    if (ids && ids.size) {
      const [firstId] = ids;
      return entriesById.get(firstId);
    }
  }

  return undefined;
}

export async function invokeBizMockAction(params: {
  id?: string;
  testID?: string;
  payload?: BizMockActionPayload;
  timeoutMs?: number;
}): Promise<BizMockActionResult> {
  const requested = Number(params.timeoutMs);
  const timeoutMs = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 0), MAX_MOUNT_TIMEOUT_MS)
    : DEFAULT_MOUNT_TIMEOUT_MS;

  const startedAt = Date.now();
  let entry = findBizMockAction(params);
  while (!entry && Date.now() - startedAt < timeoutMs) {
    await sleep(MOUNT_POLL_INTERVAL_MS);
    entry = findBizMockAction(params);
  }

  if (!entry) {
    const target = normalize(params.id)
      ? `id=${normalize(params.id)}`
      : `testID=${normalize(params.testID)}`;
    return {
      ok: false,
      code: 'target-not-mounted',
      message: `no mounted biz-mock action for ${target}`,
    };
  }

  const mounted = entry;
  let timedOut = false;
  try {
    await Promise.race([
      Promise.resolve().then(() => mounted.handler(params.payload)),
      sleep(HANDLER_TIMEOUT_MS).then(() => {
        timedOut = true;
      }),
    ]);
  } catch (error) {
    return {
      ok: false,
      code: 'action-failed',
      message: (error as Error)?.message || String(error),
    };
  }

  return {
    ok: true,
    code: 'ok',
    data: {
      id: mounted.id,
      testID: mounted.testID || null,
      dispatched: true,
      timedOut,
    },
  };
}
