import type {
  RegressionScenarioCommand,
  RegressionScenarioEvent,
  RegressionScenarioEventName,
  RegressionScenarioRuntimeSnapshot,
  RegressionScenarioSession,
  RegressionScenarioStatus,
} from './contracts';

const MAX_IN_MEMORY_EVENTS = 300;
const listeners = new Set<() => void>();
const claimedActionKeys = new Set<string>();
let sequence = 0;

let snapshot: RegressionScenarioRuntimeSnapshot = {
  revision: 0,
  enabled: false,
  status: 'inactive',
  command: null,
  session: null,
  events: Object.freeze([]),
  lastError: null,
};

function emit() {
  listeners.forEach(listener => listener());
}

function updateSnapshot(
  patch:
    | Partial<RegressionScenarioRuntimeSnapshot>
    | ((
        prev: RegressionScenarioRuntimeSnapshot,
      ) => Partial<RegressionScenarioRuntimeSnapshot>),
) {
  const nextPatch = typeof patch === 'function' ? patch(snapshot) : patch;
  snapshot = {
    ...snapshot,
    ...nextPatch,
    revision: snapshot.revision + 1,
  };
  emit();
}

export function getRegressionScenarioRuntimeSnapshot() {
  return snapshot;
}

export function subscribeRegressionScenarioRuntime(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setRegressionScenarioRuntimeEnabled(enabled: boolean) {
  updateSnapshot({ enabled });
}

export function activateRegressionScenarioCommand(
  command: RegressionScenarioCommand,
  session: RegressionScenarioSession,
) {
  if (snapshot.command?.runId !== command.runId) {
    claimedActionKeys.clear();
  }
  updateSnapshot({
    command,
    session,
    status: session.status,
    lastError: session.lastError || null,
  });
}

export function setRegressionScenarioRuntimeStatus(
  status: RegressionScenarioStatus,
  session?: RegressionScenarioSession | null,
  lastError?: string | null,
) {
  updateSnapshot({
    status,
    ...(session !== undefined ? { session } : {}),
    ...(lastError !== undefined ? { lastError } : {}),
  });
}

export function clearRegressionScenarioRuntime() {
  claimedActionKeys.clear();
  updateSnapshot({
    status: 'inactive',
    command: null,
    session: null,
    events: Object.freeze([]),
    lastError: null,
  });
}

export function claimRegressionScenarioAction(
  runId: string,
  actionKey: string,
) {
  const command = snapshot.command || snapshot.session?.command;
  if (!command || command.runId !== runId || !actionKey) {
    return false;
  }

  const key = `${runId}:${actionKey}`;
  if (claimedActionKeys.has(key)) {
    return false;
  }
  claimedActionKeys.add(key);
  return true;
}

export function reportRegressionScenarioEvent(
  name: RegressionScenarioEventName,
  data?: Readonly<Record<string, unknown>>,
) {
  const command = snapshot.command || snapshot.session?.command;
  if (!command?.runId) {
    return null;
  }

  const event: RegressionScenarioEvent = Object.freeze({
    sequence: ++sequence,
    timestamp: Date.now(),
    runId: command.runId,
    scenario: command.scenario,
    screen: command.screen,
    name,
    data,
  });

  updateSnapshot(prev => ({
    events: Object.freeze([...prev.events, event].slice(-MAX_IN_MEMORY_EVENTS)),
  }));
  return event;
}
