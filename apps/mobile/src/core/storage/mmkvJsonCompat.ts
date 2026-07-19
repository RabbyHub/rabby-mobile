type JsonParseResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
    };

function tryParseJson(value: string): JsonParseResult {
  try {
    return {
      ok: true,
      value: JSON.parse(value),
    };
  } catch {
    return {
      ok: false,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const DUPLICATED_JSON_STRING_STUB = JSON.stringify(JSON.stringify('value'));
const DUPLICATED_JSON_STRING_START = DUPLICATED_JSON_STRING_STUB.slice(0, 3);
const DUPLICATED_JSON_STRING_END = DUPLICATED_JSON_STRING_STUB.slice(-3);

function isDuplicatedJsonEncoding(value: string) {
  return (
    value.startsWith('"{\\') ||
    value.startsWith('"[') ||
    (value.startsWith(DUPLICATED_JSON_STRING_START) &&
      value.endsWith(DUPLICATED_JSON_STRING_END))
  );
}

export function unwrapDuplicatedJsonString(value: string): string {
  if (!isDuplicatedJsonEncoding(value)) {
    return value;
  }

  const outer = tryParseJson(value);
  if (!outer.ok || typeof outer.value !== 'string') {
    return value;
  }

  return outer.value;
}

export function parseMmkvJsonValue(value?: string | null): unknown {
  if (!value) {
    return null;
  }

  const parsed = tryParseJson(unwrapDuplicatedJsonString(value));
  return parsed.ok ? parsed.value : null;
}

export function readZustandPersistedState(
  value?: string | null,
): Record<string, unknown> | null {
  const parsed = parseMmkvJsonValue(value);
  if (!isRecord(parsed)) {
    return null;
  }

  return isRecord(parsed.state) ? parsed.state : parsed;
}
