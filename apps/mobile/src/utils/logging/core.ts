import {
  AppLogLevel,
  buildInlineMessageFromArgs,
  createDefaultSessionId,
  formatLogLine,
  FormattedLogRecord,
  MaskedLogValue,
  SerializableLogValue,
  serializeLogArgs,
} from './format';
import { RollingZipLogWriter, RollingZipWriterState } from './rollingZipWriter';

type ConsoleLike = {
  log?: (...args: unknown[]) => void;
  info?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
  error?: (...args: unknown[]) => void;
  debug?: (...args: unknown[]) => void;
  trace?: (...args: unknown[]) => void;
  time?: (label?: string) => void;
  timeLog?: (label?: string, ...args: unknown[]) => void;
  timeEnd?: (label?: string) => void;
  assert?: (condition?: boolean, ...args: unknown[]) => void;
};

type BoundConsoleLike = {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
  time: (label?: string) => void;
  timeLog: (label?: string, ...args: unknown[]) => void;
  timeEnd: (label?: string) => void;
  assert: (condition?: boolean, ...args: unknown[]) => void;
};

type InMemoryLogLevel = 'info' | 'warn' | 'error' | 'debug';

type AppLoggerOptions = {
  runtimeEnv: string;
  platform?: string;
  writer: RollingZipLogWriter;
  shouldWriteToFile: () => boolean;
  shouldCaptureConsole?: () => boolean;
  originalConsole?: ConsoleLike;
  sessionId?: string;
  now?: () => Date;
  captureInMemory?: boolean;
  onInMemoryLog?: (entry: {
    level: InMemoryLogLevel;
    message: string;
    data?: SerializableLogValue;
  }) => void;
};

type LoggerState = RollingZipWriterState & {
  runtimeEnv: string;
  sessionId: string;
  effectiveFileLoggingEnabled: boolean;
  effectiveConsoleCaptureEnabled: boolean;
};

const noop = (..._args: unknown[]) => {};

function bindConsoleMethod(
  thisArg: ConsoleLike,
  value: ConsoleLike[keyof ConsoleLike] | undefined,
): (...args: unknown[]) => void {
  if (typeof value !== 'function') {
    return noop;
  }

  return value.bind(thisArg) as (...args: unknown[]) => void;
}

function hasMaskedValue(
  input: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): boolean {
  if (input instanceof MaskedLogValue) {
    return true;
  }

  if (!input || typeof input !== 'object') {
    return false;
  }

  if (seen.has(input)) {
    return false;
  }
  seen.add(input);

  if (depth >= 4) {
    return false;
  }

  if (Array.isArray(input)) {
    return input.some(item => hasMaskedValue(item, seen, depth + 1));
  }

  return Object.values(input as Record<string, unknown>).some(item =>
    hasMaskedValue(item, seen, depth + 1),
  );
}

function mapToInMemoryLevel(level: AppLogLevel): InMemoryLogLevel {
  switch (level) {
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    case 'debug':
    case 'trace':
      return 'debug';
    default:
      return 'info';
  }
}

export class AppLogger {
  readonly mask = <T>(value: T) => new MaskedLogValue(value);

  private readonly writer: RollingZipLogWriter;
  private readonly runtimeEnv: string;
  private readonly platform?: string;
  private readonly shouldWriteToFile: () => boolean;
  private readonly shouldCaptureConsole: () => boolean;
  private readonly now: () => Date;
  private readonly captureInMemory: boolean;
  private readonly onInMemoryLog?: AppLoggerOptions['onInMemoryLog'];
  private readonly originalConsole: BoundConsoleLike;

  private sequence = 0;
  private writeQueue = Promise.resolve<void>(undefined);
  private lastWriteEnabled: boolean;
  private readonly sessionId: string;
  private consoleCaptureInstalled = false;
  private readonly timers = new Map<string, number>();

  constructor(options: AppLoggerOptions) {
    this.writer = options.writer;
    this.runtimeEnv = options.runtimeEnv;
    this.platform = options.platform;
    this.shouldWriteToFile = options.shouldWriteToFile;
    this.shouldCaptureConsole =
      options.shouldCaptureConsole || options.shouldWriteToFile;
    this.now = options.now || (() => new Date());
    this.captureInMemory = !!options.captureInMemory;
    this.onInMemoryLog = options.onInMemoryLog;
    this.lastWriteEnabled = this.shouldWriteToFile();
    this.sessionId = options.sessionId || createDefaultSessionId(this.now());

    const consoleLike = options.originalConsole || console;
    this.originalConsole = {
      log: bindConsoleMethod(consoleLike, consoleLike.log),
      info: bindConsoleMethod(consoleLike, consoleLike.info),
      warn: bindConsoleMethod(consoleLike, consoleLike.warn),
      error: bindConsoleMethod(consoleLike, consoleLike.error),
      debug: bindConsoleMethod(consoleLike, consoleLike.debug),
      trace: bindConsoleMethod(consoleLike, consoleLike.trace),
      time: bindConsoleMethod(consoleLike, consoleLike.time) as (
        label?: string,
      ) => void,
      timeLog: bindConsoleMethod(consoleLike, consoleLike.timeLog) as (
        label?: string,
        ...args: unknown[]
      ) => void,
      timeEnd: bindConsoleMethod(consoleLike, consoleLike.timeEnd) as (
        label?: string,
      ) => void,
      assert: bindConsoleMethod(consoleLike, consoleLike.assert) as (
        condition?: boolean,
        ...args: unknown[]
      ) => void,
    };
  }

  private enqueue<T>(task: () => Promise<T>) {
    const run = this.writeQueue.then(task);

    this.writeQueue = run
      .then(() => undefined)
      .catch(error => {
        this.originalConsole.error(
          '[AppLogger] background write failed',
          error,
        );
      });

    return run;
  }

  private buildRecord({
    level,
    source,
    method,
    args,
    meta,
  }: {
    level: AppLogLevel;
    source: string;
    method: string;
    args: unknown[];
    meta?: Record<string, unknown>;
  }) {
    const serializedArgs = serializeLogArgs(args);
    const serializedMeta =
      meta && Object.keys(meta).length
        ? serializeLogArgs([meta])[0]
        : undefined;
    const record: FormattedLogRecord = {
      timestamp: this.now().toISOString(),
      level,
      source,
      method,
      env: this.runtimeEnv,
      sessionId: this.sessionId,
      sequence: ++this.sequence,
      platform: this.platform,
      body: {
        message: buildInlineMessageFromArgs(serializedArgs),
        args: serializedArgs,
        ...(serializedMeta ? { meta: serializedMeta } : {}),
      },
    };

    return {
      record,
      serializedArgs,
    };
  }

  private captureRecord(
    level: AppLogLevel,
    source: string,
    method: string,
    args: unknown[],
    meta?: Record<string, unknown>,
  ) {
    const { record, serializedArgs } = this.buildRecord({
      level,
      source,
      method,
      args,
      meta,
    });

    if (this.captureInMemory && this.onInMemoryLog) {
      const extraData =
        record.body.meta ||
        (record.body.args.length > 1 ? record.body.args : record.body.args[0]);
      this.onInMemoryLog({
        level: mapToInMemoryLevel(level),
        message: record.body.message || `[${method}]`,
        data: extraData,
      });
    }

    const shouldWrite = this.shouldWriteToFile();
    if (this.lastWriteEnabled && !shouldWrite) {
      this.enqueue(async () => {
        await this.writer.finalizeArchive();
      }).catch(noop);
    }
    this.lastWriteEnabled = shouldWrite;

    if (shouldWrite) {
      const line = formatLogLine(record);
      this.enqueue(async () => {
        await this.writer.writeLine(line);
      }).catch(noop);
    }

    return serializedArgs;
  }

  private getConsoleEchoArgs(
    rawArgs: unknown[],
    serializedArgs: SerializableLogValue[],
    sanitizeAll: boolean,
  ) {
    if (sanitizeAll || rawArgs.some(item => hasMaskedValue(item))) {
      return serializedArgs as unknown[];
    }

    return rawArgs;
  }

  log(...args: unknown[]) {
    const serializedArgs = this.captureRecord('log', 'logger', 'log', args);
    this.originalConsole.log(...(serializedArgs as unknown[]));
  }

  info(...args: unknown[]) {
    const serializedArgs = this.captureRecord('info', 'logger', 'info', args);
    this.originalConsole.info(...(serializedArgs as unknown[]));
  }

  warn(...args: unknown[]) {
    const serializedArgs = this.captureRecord('warn', 'logger', 'warn', args);
    this.originalConsole.warn(...(serializedArgs as unknown[]));
  }

  error(...args: unknown[]) {
    const serializedArgs = this.captureRecord('error', 'logger', 'error', args);
    this.originalConsole.error(...(serializedArgs as unknown[]));
  }

  debug(...args: unknown[]) {
    const serializedArgs = this.captureRecord('debug', 'logger', 'debug', args);
    this.originalConsole.debug(...(serializedArgs as unknown[]));
  }

  trace(...args: unknown[]) {
    const traceStack = new Error('[logger.trace]').stack;
    const serializedArgs = this.captureRecord(
      'trace',
      'logger',
      'trace',
      args,
      {
        traceStack,
      },
    );
    this.originalConsole.trace(...(serializedArgs as unknown[]));
  }

  installConsoleCapture(consoleTarget: ConsoleLike = console) {
    if (this.consoleCaptureInstalled) {
      return;
    }

    this.consoleCaptureInstalled = true;

    consoleTarget.log = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.log(...args);
        return;
      }

      const serializedArgs = this.captureRecord('log', 'console', 'log', args);
      this.originalConsole.log(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.info = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.info(...args);
        return;
      }

      const serializedArgs = this.captureRecord(
        'info',
        'console',
        'info',
        args,
      );
      this.originalConsole.info(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.warn = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.warn(...args);
        return;
      }

      const serializedArgs = this.captureRecord(
        'warn',
        'console',
        'warn',
        args,
      );
      this.originalConsole.warn(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.error = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.error(...args);
        return;
      }

      const serializedArgs = this.captureRecord(
        'error',
        'console',
        'error',
        args,
      );
      this.originalConsole.error(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.debug = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.debug(...args);
        return;
      }

      const serializedArgs = this.captureRecord(
        'debug',
        'console',
        'debug',
        args,
      );
      this.originalConsole.debug(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.trace = (...args: unknown[]) => {
      if (!this.shouldCaptureConsole()) {
        this.originalConsole.trace(...args);
        return;
      }

      const traceStack = new Error('[console.trace]').stack;
      const serializedArgs = this.captureRecord(
        'trace',
        'console',
        'trace',
        args,
        { traceStack },
      );
      this.originalConsole.trace(
        ...this.getConsoleEchoArgs(args, serializedArgs, false),
      );
    };

    consoleTarget.time = (label?: string) => {
      const timerLabel = label || 'default';

      if (!this.shouldCaptureConsole()) {
        this.originalConsole.time(timerLabel);
        return;
      }

      this.timers.set(timerLabel, this.now().getTime());

      this.captureRecord(
        'debug',
        'console',
        'time',
        [`[timer:start] ${timerLabel}`],
        {
          label: timerLabel,
        },
      );
      this.originalConsole.time(timerLabel);
    };

    consoleTarget.timeLog = (label?: string, ...args: unknown[]) => {
      const timerLabel = label || 'default';

      if (!this.shouldCaptureConsole()) {
        this.originalConsole.timeLog(timerLabel, ...args);
        return;
      }

      const startedAt = this.timers.get(timerLabel);
      const durationMs =
        typeof startedAt === 'number' ? this.now().getTime() - startedAt : null;

      const computedArgs = [
        `${timerLabel}: ${durationMs ?? 'unknown'}ms`,
        ...args,
      ];
      const serializedArgs = this.captureRecord(
        'info',
        'console',
        'timeLog',
        computedArgs,
        {
          label: timerLabel,
          durationMs,
        },
      );

      this.originalConsole.timeLog(
        timerLabel,
        ...this.getConsoleEchoArgs(computedArgs, serializedArgs, false).slice(
          1,
        ),
      );
    };

    consoleTarget.timeEnd = (label?: string) => {
      const timerLabel = label || 'default';

      if (!this.shouldCaptureConsole()) {
        this.timers.delete(timerLabel);
        this.originalConsole.timeEnd(timerLabel);
        return;
      }

      const startedAt = this.timers.get(timerLabel);
      const durationMs =
        typeof startedAt === 'number' ? this.now().getTime() - startedAt : null;

      this.timers.delete(timerLabel);

      const computedArgs = [`${timerLabel}: ${durationMs ?? 'unknown'}ms`];
      const serializedArgs = this.captureRecord(
        'info',
        'console',
        'timeEnd',
        computedArgs,
        {
          label: timerLabel,
          durationMs,
        },
      );

      this.originalConsole.timeEnd(timerLabel);

      if (!startedAt) {
        this.originalConsole.info(...serializedArgs);
      }
    };

    consoleTarget.assert = (condition?: boolean, ...args: unknown[]) => {
      if (!this.shouldCaptureConsole() || condition) {
        this.originalConsole.assert(condition, ...args);
        return;
      }

      const actualArgs = args.length ? args : ['Assertion failed'];
      const serializedArgs = this.captureRecord(
        'error',
        'console',
        'assert',
        actualArgs,
      );
      this.originalConsole.assert(
        false,
        ...this.getConsoleEchoArgs(actualArgs, serializedArgs, false),
      );
    };
  }

  handlePolicyChange() {
    const nextEnabled = this.shouldWriteToFile();
    if (this.lastWriteEnabled && !nextEnabled) {
      this.lastWriteEnabled = nextEnabled;
      return this.enqueue(async () => {
        await this.writer.finalizeArchive();
      });
    }

    this.lastWriteEnabled = nextEnabled;
    return Promise.resolve();
  }

  handleAppStateChange(nextState: string) {
    if (nextState === 'active') {
      return Promise.resolve(null);
    }

    return this.enqueue(async () => this.writer.finalizeArchive());
  }

  flush() {
    return this.enqueue(async () => {
      await this.writer.flush();
    });
  }

  finalizeArchive() {
    return this.enqueue(async () => this.writer.finalizeArchive());
  }

  getState(): LoggerState {
    return {
      ...this.writer.getState(),
      runtimeEnv: this.runtimeEnv,
      sessionId: this.sessionId,
      effectiveFileLoggingEnabled: this.shouldWriteToFile(),
      effectiveConsoleCaptureEnabled: this.shouldCaptureConsole(),
    };
  }
}
