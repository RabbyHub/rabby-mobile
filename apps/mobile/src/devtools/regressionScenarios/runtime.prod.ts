import type {
  RegressionScenarioCommand,
  RegressionScenarioEventName,
  RegressionScenarioRuntimeSnapshot,
} from './contracts';
import type { RegressionScenarioCommandParseResult } from './command';

const PROD_SNAPSHOT = Object.freeze<RegressionScenarioRuntimeSnapshot>({
  revision: 0,
  enabled: false,
  status: 'inactive',
  command: null,
  session: null,
  events: Object.freeze([]),
  lastError: null,
});

export function parseRegressionScenarioLink(): RegressionScenarioCommandParseResult {
  return { matched: false };
}

export function handleRegressionScenarioCommand(
  _command: RegressionScenarioCommand | null,
  _parseError?: string,
) {
  return false;
}

export function restoreRegressionScenarioSession() {
  return null;
}

export function getRegressionScenarioRuntimeSnapshot() {
  return PROD_SNAPSHOT;
}

export function subscribeRegressionScenarioRuntime(_listener: () => void) {
  return () => {};
}

export function reportRegressionScenarioEvent(
  _name: RegressionScenarioEventName,
  _data?: Readonly<Record<string, unknown>>,
) {
  return null;
}

export function clearRegressionScenarioSession() {}

export function beginRegressionScenarioRun(_status: 'preparing' | 'running') {}

export function finishRegressionScenario(
  _status: 'passed' | 'failed' | 'cancelled',
  _error?: string,
) {}

export function sanitizeLinkForLogging(appLink: string) {
  return appLink ? '<app-link-redacted>' : '';
}
