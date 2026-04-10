export type AppLogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';

export class MaskedLogValue<T = unknown> {
  constructor(readonly value: T) {}
}

export type SerializableLogValue =
  | null
  | boolean
  | number
  | string
  | SerializableLogValue[]
  | { [key: string]: SerializableLogValue };

export type FormattedLogRecord = {
  timestamp: string;
  level: AppLogLevel;
  source: string;
  method: string;
  env: string;
  sessionId: string;
  sequence: number;
  platform?: string;
  body: {
    message: string;
    args: SerializableLogValue[];
    meta?: SerializableLogValue;
  };
};

const FILE_TIMESTAMP_SEPARATOR = '_';
const HEADER_PREFIX = '@rabby-log/v1';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function pad3(value: number) {
  return String(value).padStart(3, '0');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeHeaderToken(value: string | number | boolean | undefined) {
  return String(value ?? '').replace(/\s+/g, '_');
}

function truncateText(value: string, maxLen = 500) {
  if (value.length <= maxLen) {
    return value;
  }

  return `${value.slice(0, maxLen - 3)}...`;
}

function maskString(value: string) {
  if (!value) {
    return '***';
  }

  return '*'.repeat(Math.min(Math.max(value.length, 3), 32));
}

function maskValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number,
): SerializableLogValue {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return '***';
  }

  if (typeof value === 'string') {
    return maskString(value);
  }

  if (value instanceof Date) {
    return '***';
  }

  if (value instanceof Error) {
    const result: Record<string, SerializableLogValue> = {
      $type: value.name || 'Error',
      message: '***',
    };

    if (value.stack) {
      result.stack = '***';
    }

    if ('cause' in value && value.cause !== undefined) {
      result.cause = maskValue(value.cause, seen, depth + 1, maxDepth);
    }

    Object.keys(value).forEach(key => {
      if (key === 'message' || key === 'stack' || key === 'cause') {
        return;
      }
      result[key] = maskValue(
        (value as unknown as Record<string, unknown>)[key],
        seen,
        depth + 1,
        maxDepth,
      );
    });

    return result;
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) {
      return `***[${value.length}]`;
    }

    return value.map(item => maskValue(item, seen, depth + 1, maxDepth));
  }

  if (ArrayBuffer.isView(value)) {
    return `***[${value.constructor.name}]`;
  }

  if (value instanceof ArrayBuffer) {
    return '***[ArrayBuffer]';
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (depth >= maxDepth) {
      return `***[${value.constructor?.name || 'Object'}]`;
    }

    if (!isPlainObject(value)) {
      return {
        $type: value.constructor?.name || 'Object',
      };
    }

    const output: Record<string, SerializableLogValue> = {};
    Object.keys(value).forEach(key => {
      output[key] = maskValue(
        (value as Record<string, unknown>)[key],
        seen,
        depth + 1,
        maxDepth,
      );
    });
    return output;
  }

  return '***';
}

function serializeError(
  error: Error,
  seen: WeakSet<object>,
  depth: number,
  maxDepth: number,
) {
  const result: Record<string, SerializableLogValue> = {
    $type: error.name || 'Error',
    message: error.message,
  };

  if (error.stack) {
    result.stack = error.stack;
  }

  if ('cause' in error && error.cause !== undefined) {
    result.cause = serializeLogValue(error.cause, seen, depth + 1, maxDepth);
  }

  Object.keys(error).forEach(key => {
    if (key === 'message' || key === 'stack' || key === 'cause') {
      return;
    }

    result[key] = serializeLogValue(
      (error as unknown as Record<string, unknown>)[key],
      seen,
      depth + 1,
      maxDepth,
    );
  });

  return result;
}

export function serializeLogValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
  maxDepth = 6,
): SerializableLogValue {
  if (value instanceof MaskedLogValue) {
    return maskValue(value.value, seen, depth, maxDepth);
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return '[NaN]';
    }

    if (!Number.isFinite(value)) {
      return String(value);
    }

    return value;
  }

  if (typeof value === 'undefined') {
    return '[undefined]';
  }

  if (typeof value === 'bigint') {
    return `${value.toString()}n`;
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? '[Invalid Date]'
      : value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value, seen, depth, maxDepth);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (depth >= maxDepth) {
      return `[Array(${value.length})]`;
    }

    return value.map(item =>
      serializeLogValue(item, seen, depth + 1, maxDepth),
    );
  }

  if (ArrayBuffer.isView(value)) {
    return `[${value.constructor.name}(${value.byteLength})]`;
  }

  if (value instanceof ArrayBuffer) {
    return `[ArrayBuffer(${value.byteLength})]`;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    if (depth >= maxDepth) {
      return `[${value.constructor?.name || 'Object'}]`;
    }

    if (!isPlainObject(value)) {
      const output: Record<string, SerializableLogValue> = {
        $type: value.constructor?.name || 'Object',
      };

      Object.keys(value as Record<string, unknown>).forEach(key => {
        output[key] = serializeLogValue(
          (value as Record<string, unknown>)[key],
          seen,
          depth + 1,
          maxDepth,
        );
      });

      return output;
    }

    const output: Record<string, SerializableLogValue> = {};
    Object.keys(value).forEach(key => {
      output[key] = serializeLogValue(
        (value as Record<string, unknown>)[key],
        seen,
        depth + 1,
        maxDepth,
      );
    });

    return output;
  }

  return String(value);
}

function stringifyForInlineText(value: SerializableLogValue) {
  if (typeof value === 'string') {
    return value;
  }

  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

export function buildInlineMessageFromArgs(args: SerializableLogValue[]) {
  if (!args.length) {
    return '';
  }

  return truncateText(
    args
      .map(item => stringifyForInlineText(item))
      .filter(Boolean)
      .join(' '),
  );
}

export function serializeLogArgs(args: unknown[]) {
  return args.map(item => serializeLogValue(item));
}

export function formatLogLine(record: FormattedLogRecord) {
  const header = [
    HEADER_PREFIX,
    `ts=${sanitizeHeaderToken(record.timestamp)}`,
    `lvl=${sanitizeHeaderToken(record.level)}`,
    `src=${sanitizeHeaderToken(record.source)}`,
    `method=${sanitizeHeaderToken(record.method)}`,
    `env=${sanitizeHeaderToken(record.env)}`,
    `sid=${sanitizeHeaderToken(record.sessionId)}`,
    `seq=${record.sequence}`,
    'fmt=json',
    record.platform ? `platform=${sanitizeHeaderToken(record.platform)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `${header} ${JSON.stringify(record.body)}\n`;
}

export function formatDateFolder(date: Date) {
  return [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join('-');
}

export function formatFileTimestamp(date: Date) {
  return [
    formatDateFolder(date),
    [
      pad2(date.getHours()),
      pad2(date.getMinutes()),
      pad2(date.getSeconds()),
    ].join('-'),
    pad3(date.getMilliseconds()),
  ].join(FILE_TIMESTAMP_SEPARATOR);
}

export function createDefaultSessionId(date: Date = new Date()) {
  return [
    formatFileTimestamp(date),
    Math.random().toString(36).slice(2, 8),
  ].join('-');
}
