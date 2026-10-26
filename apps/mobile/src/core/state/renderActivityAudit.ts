import { isNonProductionDiagnosticsEnabled } from '@/core/utils/diagnosticEnv';

const MAX_RECENT_EVENTS = 40;

export type RenderActivityAuditEvent = {
  type: 'inactive-parent-update' | 'inactive-subtree-commit';
  timestamp: number;
  phase?: 'mount' | 'update' | 'nested-update';
  actualDuration?: number;
  baseDuration?: number;
  startTime?: number;
  commitTime?: number;
};

export type RenderActivityAuditScopeDiagnostics = {
  label: string;
  active: boolean;
  activationCount: number;
  deactivationCount: number;
  inactiveParentUpdateCount: number;
  inactiveSubtreeCommitCount: number;
  inactiveActualDuration: number;
  recentEvents: RenderActivityAuditEvent[];
};

export type RenderActivityAuditDiagnosticsSnapshot = {
  enabled: boolean;
  scopes: RenderActivityAuditScopeDiagnostics[];
};

export type RenderActivityAuditScope = {
  setActive: (active: boolean) => void;
  recordParentUpdate: () => void;
  recordSubtreeCommit: (event: {
    phase: 'mount' | 'update' | 'nested-update';
    actualDuration: number;
    baseDuration: number;
    startTime: number;
    commitTime: number;
    activityTransition: boolean;
  }) => void;
  getDiagnostics: () => RenderActivityAuditScopeDiagnostics;
};

type ScopeRegistration = {
  id: number;
  scope: RenderActivityAuditScope;
};

const registrations = isNonProductionDiagnosticsEnabled
  ? new Map<number, ScopeRegistration>()
  : null;

let nextRegistrationId = 0;

function appendRecentEvent(
  events: RenderActivityAuditEvent[],
  event: RenderActivityAuditEvent,
) {
  events.push(event);
  if (events.length > MAX_RECENT_EVENTS) {
    events.splice(0, events.length - MAX_RECENT_EVENTS);
  }
}

export function createRenderActivityAuditScope({
  active,
  label,
}: {
  active: boolean;
  label: string;
}): RenderActivityAuditScope {
  let currentActive = active;
  let activationCount = 0;
  let deactivationCount = 0;
  let inactiveParentUpdateCount = 0;
  let inactiveSubtreeCommitCount = 0;
  let inactiveActualDuration = 0;
  const recentEvents: RenderActivityAuditEvent[] = [];

  return {
    setActive(nextActive) {
      if (currentActive === nextActive) {
        return;
      }
      currentActive = nextActive;
      if (nextActive) {
        activationCount += 1;
      } else {
        deactivationCount += 1;
      }
    },
    recordParentUpdate() {
      if (currentActive) {
        return;
      }
      inactiveParentUpdateCount += 1;
      appendRecentEvent(recentEvents, {
        type: 'inactive-parent-update',
        timestamp: Date.now(),
      });
    },
    recordSubtreeCommit(event) {
      if (
        currentActive ||
        event.activityTransition ||
        event.phase === 'mount'
      ) {
        return;
      }
      inactiveSubtreeCommitCount += 1;
      inactiveActualDuration += event.actualDuration;
      appendRecentEvent(recentEvents, {
        type: 'inactive-subtree-commit',
        timestamp: Date.now(),
        phase: event.phase,
        actualDuration: event.actualDuration,
        baseDuration: event.baseDuration,
        startTime: event.startTime,
        commitTime: event.commitTime,
      });
    },
    getDiagnostics() {
      return {
        label,
        active: currentActive,
        activationCount,
        deactivationCount,
        inactiveParentUpdateCount,
        inactiveSubtreeCommitCount,
        inactiveActualDuration,
        recentEvents: [...recentEvents],
      };
    },
  };
}

export function registerRenderActivityAuditScope(
  scope: RenderActivityAuditScope,
) {
  if (!registrations) {
    return () => undefined;
  }

  const id = ++nextRegistrationId;
  registrations.set(id, { id, scope });

  return () => {
    registrations.delete(id);
  };
}

export function getRenderActivityAuditDiagnosticsSnapshot(
  options: {
    eventLimit?: number;
    violationsOnly?: boolean;
  } = {},
): RenderActivityAuditDiagnosticsSnapshot {
  if (!registrations) {
    return {
      enabled: false,
      scopes: [],
    };
  }

  const eventLimit = Math.min(
    Math.max(Math.round(options.eventLimit ?? MAX_RECENT_EVENTS), 0),
    MAX_RECENT_EVENTS,
  );
  const scopes = [...registrations.values()]
    .sort((left, right) => left.id - right.id)
    .map(registration => registration.scope.getDiagnostics())
    .filter(
      scope =>
        !options.violationsOnly ||
        scope.inactiveParentUpdateCount > 0 ||
        scope.inactiveSubtreeCommitCount > 0,
    )
    .map(scope => ({
      ...scope,
      recentEvents:
        eventLimit === 0 ? [] : scope.recentEvents.slice(-eventLimit),
    }));

  return {
    enabled: true,
    scopes,
  };
}

export function getLatestRenderActivityAuditScopeDiagnostics(label: string) {
  const scopes = getRenderActivityAuditDiagnosticsSnapshot().scopes;

  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    if (scopes[index]?.label === label) {
      return scopes[index]!;
    }
  }

  return null;
}
