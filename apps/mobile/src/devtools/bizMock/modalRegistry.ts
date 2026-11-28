import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';

export type BizMockModalKind = 'standalone' | 'global-legacy' | 'global-2024';

export type BizMockModalDescriptor = {
  kind?: BizMockModalKind;
  id?: string;
  name?: string;
  testID?: string;
  active?: boolean;
  instance?: BottomSheetModalMethods | null;
};

export type BizMockModalQuery = {
  id?: string;
  testID?: string;
  name?: string;
  kind?: BizMockModalKind | 'global';
  top?: boolean;
  timeoutMs?: number;
};

type BizMockModalEntry = {
  registryId: string;
  kind: BizMockModalKind;
  id?: string;
  name?: string;
  testID?: string;
  seq: number;
  active: boolean;
  instance: BottomSheetModalMethods | null;
  waiters: Set<() => void>;
};

const entries = new Map<string, BizMockModalEntry>();
let nextSeq = 1;

function normalize(value: string | undefined) {
  return (value || '').trim();
}

function kindMatches(
  entryKind: BizMockModalKind,
  requested: BizMockModalQuery['kind'],
) {
  if (!requested) {
    return true;
  }
  if (requested === 'global') {
    return entryKind === 'global-legacy' || entryKind === 'global-2024';
  }
  return entryKind === requested;
}

function describe(entry: BizMockModalEntry) {
  return {
    registryId: entry.registryId,
    kind: entry.kind,
    id: entry.id || null,
    name: entry.name || null,
    testID: entry.testID || null,
    active: entry.active,
    mounted: Boolean(entry.instance),
  };
}

function notifyInactive(entry: BizMockModalEntry) {
  const waiters = Array.from(entry.waiters);
  entry.waiters.clear();
  waiters.forEach(resolve => resolve());
}

function waitForInactive(entry: BizMockModalEntry, timeoutMs: number) {
  if (!entry.active) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>(resolve => {
    const finish = (value: boolean) => {
      clearTimeout(timer);
      entry.waiters.delete(onInactive);
      resolve(value);
    };
    const onInactive = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    entry.waiters.add(onInactive);
  });
}

function matches(entry: BizMockModalEntry, query: BizMockModalQuery) {
  if (!kindMatches(entry.kind, query.kind)) {
    return false;
  }

  const id = normalize(query.id);
  if (id && entry.id !== id && entry.registryId !== id) {
    return false;
  }

  const testID = normalize(query.testID);
  if (testID && entry.testID !== testID) {
    return false;
  }

  const name = normalize(query.name);
  if (name && entry.name !== name) {
    return false;
  }

  return true;
}

function hasSelector(query: BizMockModalQuery) {
  return Boolean(
    normalize(query.id) ||
      normalize(query.testID) ||
      normalize(query.name) ||
      query.kind,
  );
}

export function registerBizMockModal(descriptor: BizMockModalDescriptor = {}) {
  const seq = nextSeq++;
  const registryId = `bizmock-modal-${seq}`;
  const entry: BizMockModalEntry = {
    registryId,
    kind: descriptor.kind || 'standalone',
    id: normalize(descriptor.id) || undefined,
    name: normalize(descriptor.name) || undefined,
    testID: normalize(descriptor.testID) || undefined,
    seq,
    active: Boolean(descriptor.active),
    instance: descriptor.instance || null,
    waiters: new Set(),
  };
  entries.set(registryId, entry);

  return {
    registryId,
    unregister: () => {
      entry.active = false;
      notifyInactive(entry);
      entries.delete(registryId);
    },
  };
}

export function updateBizMockModalInstance(
  registryId: string,
  instance: BottomSheetModalMethods | null,
) {
  const entry = entries.get(registryId);
  if (!entry) {
    return;
  }
  entry.instance = instance;
  if (!instance) {
    entry.active = false;
    notifyInactive(entry);
  }
}

export function setBizMockModalActive(registryId: string, active: boolean) {
  const entry = entries.get(registryId);
  if (!entry) {
    return;
  }
  entry.active = active;
  if (!active) {
    notifyInactive(entry);
  }
}

export function listBizMockModals() {
  return Array.from(entries.values())
    .sort((left, right) => left.seq - right.seq)
    .map(describe);
}

export function findBizMockModal(query: BizMockModalQuery = {}) {
  const candidates = Array.from(entries.values()).filter(entry =>
    matches(entry, query),
  );

  if (hasSelector(query)) {
    return candidates.sort((left, right) => right.seq - left.seq)[0];
  }

  return candidates
    .filter(entry => entry.active)
    .sort((left, right) => right.seq - left.seq)[0];
}

export async function dismissBizMockModal(
  query: BizMockModalQuery = {},
): Promise<
  | { ok: true; data: ReturnType<typeof describe> }
  | { ok: false; code: string; message: string }
> {
  const entry = findBizMockModal(query);
  if (!entry) {
    return {
      ok: false,
      code: 'modal-not-found',
      message: 'no matching biz-mock modal is mounted',
    };
  }
  if (!entry.instance) {
    return {
      ok: false,
      code: 'modal-instance-missing',
      message: 'matching modal has no mounted sheet instance',
    };
  }

  const timeoutMs = Math.max(0, Number(query.timeoutMs ?? 3000));
  const dismissed = waitForInactive(entry, timeoutMs);
  entry.instance.dismiss();

  if (!(await dismissed)) {
    return {
      ok: false,
      code: 'modal-dismiss-timeout',
      message: `modal did not finish dismissing within ${timeoutMs}ms`,
    };
  }

  return {
    ok: true,
    data: describe(entry),
  };
}

export async function dismissAllBizMockModals(timeoutMs = 3000) {
  const activeEntries = Array.from(entries.values()).filter(
    entry => entry.active && entry.instance,
  );

  await Promise.all(
    activeEntries.map(entry =>
      dismissBizMockModal({ id: entry.registryId, timeoutMs }),
    ),
  );

  return activeEntries.length;
}

export function resetBizMockModalsForTests() {
  entries.clear();
  nextSeq = 1;
}
