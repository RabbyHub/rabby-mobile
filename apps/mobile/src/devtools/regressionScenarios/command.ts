import { urlUtils } from '@rabby-wallet/base-utils';

import {
  REGRESSION_CREDENTIAL_PROFILES,
  REGRESSION_SCENARIO_ACTIONS,
  REGRESSION_SCENARIO_IDS,
  REGRESSION_SCREEN_IDS,
  type RegressionCredentialProfile,
  type RegressionScenarioAction,
  type RegressionScenarioCommand,
  type RegressionScenarioId,
  type RegressionScreenId,
} from './contracts';

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000;
const MIN_EXPIRY_MS = 30 * 1000;
const MAX_EXPIRY_MS = 30 * 60 * 1000;
const DEFAULT_REMAINING_LAUNCHES = 1;
const MAX_REMAINING_LAUNCHES = 3;

const COMMON_QUERY_KEYS = new Set([
  'mode',
  'action',
  'commandId',
  'runId',
  'scenario',
  'screen',
  'fixture',
  'credentialProfile',
  'persist',
  'expiresInMs',
  'remainingLaunches',
  '_cmd',
]);

const FORBIDDEN_QUERY_KEYS = [
  'password',
  'pwd',
  'privatekey',
  'private_key',
  'mnemonic',
  'seed',
  'seedphrase',
  'seed_phrase',
  'secret',
  'vaultkey',
  'vault_key',
] as const;

const OPAQUE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;

export type RegressionScenarioCommandParseResult =
  | {
      matched: false;
    }
  | {
      matched: true;
      command: RegressionScenarioCommand | null;
      error?: string;
    };

function parseBoolean(value: string | null) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function isKnownValue<TValue extends string>(
  values: readonly TValue[],
  value: string,
): value is TValue {
  return values.includes(value as TValue);
}

function isLifecycleE2ETarget(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1] === 'test';
}

function hasForbiddenQuery(params: URLSearchParams) {
  let forbiddenKey: string | undefined;
  params.forEach((_value, key) => {
    if (
      !forbiddenKey &&
      FORBIDDEN_QUERY_KEYS.includes(
        key.toLowerCase() as (typeof FORBIDDEN_QUERY_KEYS)[number],
      )
    ) {
      forbiddenKey = key;
    }
  });
  return forbiddenKey;
}

function readOpaqueId(params: URLSearchParams, key: string, required: boolean) {
  const value = params.get(key)?.trim() || '';
  if (!value && !required) {
    return '';
  }
  if (!OPAQUE_ID_PATTERN.test(value)) {
    throw new Error(`Invalid ${key}`);
  }
  return value;
}

function readParams(params: URLSearchParams) {
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!COMMON_QUERY_KEYS.has(key)) {
      result[key] = value;
    }
  });
  return Object.freeze(result);
}

export function parseRegressionScenarioCommand(
  appLink: string,
  now = Date.now(),
): RegressionScenarioCommandParseResult {
  const urlInfo = urlUtils.safeParseURL(appLink);
  if (
    !urlInfo ||
    !isLifecycleE2ETarget(urlInfo.pathname) ||
    urlInfo.searchParams.get('mode') !== 'lifecycle-e2e'
  ) {
    return { matched: false };
  }

  try {
    const forbiddenKey = hasForbiddenQuery(urlInfo.searchParams);
    if (forbiddenKey) {
      throw new Error(
        `Sensitive query parameter is forbidden: ${forbiddenKey}`,
      );
    }

    const actionRaw = urlInfo.searchParams.get('action') || 'start';
    if (
      !isKnownValue<RegressionScenarioAction>(
        REGRESSION_SCENARIO_ACTIONS,
        actionRaw,
      )
    ) {
      throw new Error(`Unknown lifecycle E2E action: ${actionRaw}`);
    }

    const isControlAction = [
      'configure',
      'status',
      'cancel',
      'clear-session',
    ].includes(actionRaw);
    const scenarioRaw = urlInfo.searchParams.get('scenario') || '';
    if (
      !isControlAction &&
      !isKnownValue<RegressionScenarioId>(REGRESSION_SCENARIO_IDS, scenarioRaw)
    ) {
      throw new Error(`Unknown lifecycle E2E scenario: ${scenarioRaw}`);
    }

    const screenRaw = urlInfo.searchParams.get('screen') || '';
    if (
      screenRaw &&
      !isKnownValue<RegressionScreenId>(REGRESSION_SCREEN_IDS, screenRaw)
    ) {
      throw new Error(`Unknown lifecycle E2E screen: ${screenRaw}`);
    }

    const credentialProfileRaw =
      urlInfo.searchParams.get('credentialProfile') || '';
    if (
      credentialProfileRaw &&
      !isKnownValue<RegressionCredentialProfile>(
        REGRESSION_CREDENTIAL_PROFILES,
        credentialProfileRaw,
      )
    ) {
      throw new Error(
        `Unknown lifecycle E2E credential profile: ${credentialProfileRaw}`,
      );
    }

    const runId = readOpaqueId(urlInfo.searchParams, 'runId', !isControlAction);
    const commandId =
      readOpaqueId(urlInfo.searchParams, 'commandId', false) ||
      `${runId || 'control'}.${actionRaw}.${now}`;
    const fixture =
      readOpaqueId(urlInfo.searchParams, 'fixture', false) || undefined;
    const expiryMs = parseBoundedInteger(
      urlInfo.searchParams.get('expiresInMs'),
      DEFAULT_EXPIRY_MS,
      MIN_EXPIRY_MS,
      MAX_EXPIRY_MS,
    );

    return {
      matched: true,
      command: {
        mode: 'lifecycle-e2e',
        action: actionRaw,
        commandId,
        runId,
        scenario: scenarioRaw
          ? (scenarioRaw as RegressionScenarioId)
          : undefined,
        screen: screenRaw ? (screenRaw as RegressionScreenId) : undefined,
        fixture,
        credentialProfile: credentialProfileRaw
          ? (credentialProfileRaw as RegressionCredentialProfile)
          : undefined,
        persistAcrossLaunches: parseBoolean(
          urlInfo.searchParams.get('persist'),
        ),
        expiresAt: now + expiryMs,
        remainingLaunches: parseBoundedInteger(
          urlInfo.searchParams.get('remainingLaunches'),
          DEFAULT_REMAINING_LAUNCHES,
          1,
          MAX_REMAINING_LAUNCHES,
        ),
        params: readParams(urlInfo.searchParams),
      },
    };
  } catch (error) {
    return {
      matched: true,
      command: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getRegressionConfigureEnabled(
  command: RegressionScenarioCommand,
) {
  return parseBoolean(command.params.enabled ?? null);
}

export function sanitizeLinkForLogging(appLink: string) {
  const urlInfo = urlUtils.safeParseURL(appLink);
  if (!urlInfo) {
    return '<invalid-link>';
  }

  const sensitiveKeys = new Set<string>([
    ...FORBIDDEN_QUERY_KEYS,
    'uri',
    'wc',
    'dapp',
    'url',
    'host',
    'fixturepath',
  ]);
  const redactedParams = new URLSearchParams();
  urlInfo.searchParams.forEach((value, key) => {
    redactedParams.set(
      key,
      sensitiveKeys.has(key.toLowerCase()) ? '<redacted>' : value,
    );
  });

  const query = redactedParams.toString();
  return `${urlInfo.protocol}//${urlInfo.hostname}${urlInfo.pathname}${
    query ? `?${query}` : ''
  }`;
}
