import { isNonPublicProductionEnv } from '@/constant';
import { getRenderActivityAuditDiagnosticsSnapshot } from '@/core/state/renderActivityAudit';
import { getAuthReadinessDiagnosticsSnapshot } from '@/core/utils/authReadinessDiagnostics';
import { getFeatureActivationDiagnosticsSnapshot } from '@/core/utils/featureActivationDiagnostics';
import { storeApiExpSettingData } from '@/hooks/appSettings';

import {
  getRegressionConfigureEnabled,
  parseRegressionScenarioCommand,
  sanitizeLinkForLogging,
} from './command';
import type {
  RegressionScenarioCommand,
  RegressionScenarioEventName,
  RegressionScenarioSession,
} from './contracts';
import {
  readRegressionScenarioSession,
  removeRegressionScenarioSession,
  writeRegressionScenarioSession,
} from './sessionStore';
import {
  activateRegressionScenarioCommand,
  clearRegressionScenarioRuntime,
  getRegressionScenarioRuntimeControlSnapshot,
  getRegressionScenarioRuntimeSnapshot,
  reportRegressionScenarioEvent as reportRegressionScenarioEventToStore,
  setRegressionScenarioRuntimeEnabled,
  setRegressionScenarioRuntimeStatus,
  subscribeRegressionScenarioRuntimeControl,
} from './runtimeStore';

function makeSession(
  command: RegressionScenarioCommand,
): RegressionScenarioSession {
  const now = Date.now();
  return {
    version: 1,
    command,
    status: 'armed',
    createdAt: now,
    updatedAt: now,
  };
}

function persistSessionIfNeeded(session: RegressionScenarioSession) {
  if (session.command.persistAcrossLaunches) {
    writeRegressionScenarioSession(session);
  } else {
    removeRegressionScenarioSession();
  }
}

function logScenarioResult(
  level: 'info' | 'warn' | 'error',
  message: string,
  data?: Record<string, unknown>,
) {
  const logger = console[level] || console.log;
  logger(
    '[RabbyRegressionScenario]',
    JSON.stringify({
      message,
      ...(data || {}),
    }),
  );
}

export function reportRegressionScenarioEvent(
  name: RegressionScenarioEventName,
  data?: Readonly<Record<string, unknown>>,
) {
  const event = reportRegressionScenarioEventToStore(name, data);
  if (event) {
    logScenarioResult('info', 'event', {
      event: event.name,
      sequence: event.sequence,
      timestamp: event.timestamp,
      runId: event.runId,
      scenario: event.scenario,
      screen: event.screen,
      data: event.data,
    });
  }
  return event;
}

export function parseRegressionScenarioLink(appLink: string) {
  if (!isNonPublicProductionEnv) {
    return { matched: false } as const;
  }
  return parseRegressionScenarioCommand(appLink);
}

export function handleRegressionScenarioCommand(
  command: RegressionScenarioCommand | null,
  parseError?: string,
) {
  if (!isNonPublicProductionEnv) {
    return false;
  }

  if (!command) {
    logScenarioResult('warn', 'command-rejected', {
      reason: parseError || 'invalid-command',
    });
    return true;
  }

  if (command.action === 'configure') {
    const enabled = getRegressionConfigureEnabled(command);
    storeApiExpSettingData.setScreenE2EEnabled(enabled);
    setRegressionScenarioRuntimeEnabled(enabled);
    if (!enabled) {
      removeRegressionScenarioSession();
      clearRegressionScenarioRuntime();
    }
    logScenarioResult('info', 'configured', { enabled });
    return true;
  }

  const enabled = storeApiExpSettingData.getScreenE2EEnabled();
  setRegressionScenarioRuntimeEnabled(enabled);

  if (command.action === 'status') {
    const state = getRegressionScenarioRuntimeSnapshot();
    const includeEvents = command.params.includeEvents === 'true';
    const includeRenderActivityAudit =
      command.params.includeRenderActivityAudit === 'true';
    const includeFeatureActivation =
      command.params.includeFeatureActivation === 'true';
    const requestedRenderActivityEventLimit = Number(
      command.params.renderActivityEventLimit || 10,
    );
    const renderActivityEventLimit = Number.isFinite(
      requestedRenderActivityEventLimit,
    )
      ? Math.min(Math.max(Math.round(requestedRenderActivityEventLimit), 0), 40)
      : 10;
    const requestedEventLimit = Number(command.params.eventLimit || 80);
    const eventLimit = Number.isFinite(requestedEventLimit)
      ? Math.min(Math.max(Math.round(requestedEventLimit), 1), 300)
      : 80;
    const currentRunId =
      state.command?.runId || state.session?.command.runId || null;
    const includeAuthReadiness = command.params.includeAuthReadiness === 'true';
    const requestedAuthReadinessEventLimit = Number(
      command.params.authReadinessEventLimit || 160,
    );
    const authReadinessEventLimit = Number.isFinite(
      requestedAuthReadinessEventLimit,
    )
      ? Math.min(Math.max(Math.round(requestedAuthReadinessEventLimit), 1), 160)
      : 160;
    logScenarioResult('info', 'status', {
      enabled,
      status: state.status,
      runId: currentRunId,
      scenario:
        state.command?.scenario || state.session?.command.scenario || null,
      ...(includeEvents
        ? {
            events: state.events
              .filter(event => !currentRunId || event.runId === currentRunId)
              .slice(-eventLimit),
          }
        : {}),
      ...(includeAuthReadiness
        ? {
            authReadiness: getAuthReadinessDiagnosticsSnapshot({
              eventLimit: authReadinessEventLimit,
            }),
          }
        : {}),
      ...(includeRenderActivityAudit
        ? {
            renderActivityAudit: getRenderActivityAuditDiagnosticsSnapshot({
              eventLimit: renderActivityEventLimit,
              violationsOnly:
                command.params.renderActivityViolationsOnly === 'true',
            }),
          }
        : {}),
      ...(includeFeatureActivation
        ? {
            featureActivation: getFeatureActivationDiagnosticsSnapshot(),
          }
        : {}),
    });
    return true;
  }

  if (command.action === 'clear-session' || command.action === 'cancel') {
    if (command.action === 'cancel') {
      finishRegressionScenario('cancelled');
    } else {
      clearRegressionScenarioSession();
    }
    return true;
  }

  if (!enabled) {
    logScenarioResult('warn', 'command-rejected', {
      reason: 'persistent-switch-disabled',
      runId: command.runId,
      scenario: command.scenario,
    });
    return true;
  }

  if (command.expiresAt <= Date.now()) {
    logScenarioResult('warn', 'command-rejected', {
      reason: 'command-expired',
      runId: command.runId,
      scenario: command.scenario,
    });
    return true;
  }

  const session = makeSession(command);
  persistSessionIfNeeded(session);
  activateRegressionScenarioCommand(command, session);
  reportRegressionScenarioEvent('command-received', {
    action: command.action,
    commandId: command.commandId,
    hasFixture: !!command.fixture,
    persistAcrossLaunches: command.persistAcrossLaunches,
  });
  logScenarioResult('info', 'command-received', {
    runId: command.runId,
    scenario: command.scenario,
    action: command.action,
    commandId: command.commandId,
  });
  return true;
}

export function restoreRegressionScenarioSession() {
  if (!isNonPublicProductionEnv) {
    return null;
  }

  const enabled = storeApiExpSettingData.getScreenE2EEnabled();
  setRegressionScenarioRuntimeEnabled(enabled);
  if (!enabled) {
    removeRegressionScenarioSession();
    return null;
  }

  const session = readRegressionScenarioSession();
  if (!session) {
    return null;
  }

  const now = Date.now();
  if (
    session.command.expiresAt <= now ||
    session.command.remainingLaunches <= 0 ||
    ['passed', 'failed', 'cancelled'].includes(session.status)
  ) {
    removeRegressionScenarioSession();
    return null;
  }

  const nextCommand = {
    ...session.command,
    remainingLaunches: session.command.remainingLaunches - 1,
  };
  const nextSession: RegressionScenarioSession = {
    ...session,
    command: nextCommand,
    updatedAt: now,
  };
  writeRegressionScenarioSession(nextSession);
  activateRegressionScenarioCommand(nextCommand, nextSession);
  reportRegressionScenarioEvent('session-restored', {
    remainingLaunches: nextCommand.remainingLaunches,
  });
  return nextSession;
}

export function clearRegressionScenarioSession() {
  removeRegressionScenarioSession();
  reportRegressionScenarioEvent('session-cleared');
  clearRegressionScenarioRuntime();
}

export function beginRegressionScenarioRun(status: 'preparing' | 'running') {
  const state = getRegressionScenarioRuntimeSnapshot();
  const currentSession = state.session;
  const nextSession: RegressionScenarioSession | null = currentSession
    ? {
        ...currentSession,
        status,
        updatedAt: Date.now(),
        lastError: undefined,
      }
    : null;

  if (nextSession?.command.persistAcrossLaunches) {
    writeRegressionScenarioSession(nextSession);
  }
  setRegressionScenarioRuntimeStatus(status, nextSession, null);
  reportRegressionScenarioEvent(
    status === 'preparing' ? 'scenario-preparing' : 'scenario-running',
  );
}

export function finishRegressionScenario(
  status: 'passed' | 'failed' | 'cancelled',
  error?: string,
) {
  const state = getRegressionScenarioRuntimeSnapshot();
  const currentSession = state.session;
  const nextSession: RegressionScenarioSession | null = currentSession
    ? {
        ...currentSession,
        status,
        updatedAt: Date.now(),
        ...(error ? { lastError: error } : {}),
      }
    : null;

  if (nextSession?.command.persistAcrossLaunches) {
    writeRegressionScenarioSession(nextSession);
  } else {
    removeRegressionScenarioSession();
  }

  setRegressionScenarioRuntimeStatus(status, nextSession, error || null);
  reportRegressionScenarioEvent(
    status === 'passed'
      ? 'scenario-passed'
      : status === 'failed'
      ? 'scenario-failed'
      : 'session-cleared',
    error ? { error } : undefined,
  );
  logScenarioResult(status === 'failed' ? 'error' : 'info', status, {
    runId: state.command?.runId,
    scenario: state.command?.scenario,
    error: error || null,
  });
}

export {
  getRegressionScenarioRuntimeControlSnapshot,
  getRegressionScenarioRuntimeSnapshot,
  sanitizeLinkForLogging,
  subscribeRegressionScenarioRuntimeControl,
};
