import { appStorage } from '@/core/storage/mmkv';

import type { RegressionScenarioSession } from './contracts';

const SESSION_STORAGE_KEY = '@RegressionScenarioSessionV1';

function isSessionShape(value: unknown): value is RegressionScenarioSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const session = value as Partial<RegressionScenarioSession>;
  return (
    session.version === 1 &&
    typeof session.createdAt === 'number' &&
    typeof session.updatedAt === 'number' &&
    !!session.command &&
    session.command.mode === 'lifecycle-e2e'
  );
}

export function readRegressionScenarioSession() {
  const value = appStorage.getItem(SESSION_STORAGE_KEY) as unknown;
  return isSessionShape(value) ? value : null;
}

export function writeRegressionScenarioSession(
  session: RegressionScenarioSession,
) {
  appStorage.setItem(SESSION_STORAGE_KEY, session);
}

export function removeRegressionScenarioSession() {
  appStorage.removeItem(SESSION_STORAGE_KEY);
}
