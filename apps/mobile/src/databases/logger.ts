import * as Sentry from '@sentry/react-native';
import {
  Logger,
  QueryRunner,
  AdvancedConsoleLogger,
  SimpleConsoleLogger,
  LoggerOptions,
  AbstractLogger,
  LogLevel,
  LogMessage,
  LogMessageType,
} from 'typeorm/browser';
import { getOnlineConfig } from '@/core/config/online';
import { type ReactotronReactNative } from 'reactotron-react-native';
import { tryGetReadyTron } from '@/core/utils/reactotron-plugins/_utils';

// slice query string, [0...500] + [-500...end]
function formatQueryString(query: string, len = 500): string {
  if (query.length <= len) {
    return query;
  }

  const half = Math.floor(len / 2);

  return `${query.slice(0, half)}...${query.slice(-half)}`;
}

export const RnSqlExecutionTimes = __DEV__
  ? {
      config: 1 * 1e3,
      rnWarning: 1.5 * 1e3,
      rnError: 2 * 1e3,
    }
  : {
      config: 0.8 * 1e3,
      rnWarning: 1.3 * 1e3,
      rnError: 1.7 * 1e3,
    };

function makeLogMessages({
  level,
  stage,
  time,
  query,
  parameters,
  queryRunner,
}: {
  level: LogLevel;
  stage: number;
  time: number;
  query: string;
  parameters?: any[];
  queryRunner?: QueryRunner;
}) {
  return [
    {
      type: 'query-slow' as const,
      // prefix: `[logRnQuerySlow::${conf.level}][${chalk.blue(time)}ms >= ${chalk.blue(conf.stage)}ms]`,
      prefix: `[logRnQuerySlow::${level}][${time}ms >= ${stage}ms]`,
      message: query,
      format: 'sql' as const,
      parameters,
      additionalInfo: {
        time,
      },
    },
  ];
}

function tronLog(
  reactotron: ReactotronReactNative,
  {
    value,
    preview,
  }: {
    value: string | number | boolean | object;
    preview: string;
  },
) {
  reactotron.display({
    name: 'Database',
    value,
    preview: formatQueryString(preview, 150),
    important: true,
  });
}

const EmojiLevelMap: {
  [key in LogLevel]?: string;
} = {
  log: '📝',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

export class RabbyOrmDevConsoleLogger
  extends AdvancedConsoleLogger
  implements Logger
{
  constructor(options?: LoggerOptions) {
    super(['error', 'query', 'schema', 'migration']);
  }

  protected isLogEnabledFor(type?: LogLevel | LogMessageType): boolean {
    switch (type) {
      case 'query':
        return this._hasTron || super.isLogEnabledFor(type);
      default:
        return super.isLogEnabledFor(type);
    }
  }

  get _hasTron() {
    return !!tryGetReadyTron();
  }

  stringifyParams(parameters: any) {
    try {
      if (this._hasTron) {
        return JSON.stringify(parameters, null, 2);
      }
      return formatQueryString(JSON.stringify(parameters, null, 2), 300);
    } catch (error) {
      // most probably circular objects in parameters
      return parameters;
    }
  }

  protected writeLog(
    level: LogLevel,
    logMessage: LogMessage | LogMessage[],
    queryRunner?: QueryRunner,
  ): void {
    if (!this._hasTron) {
      return super.writeLog(level, logMessage, queryRunner);
    }

    const superFn = super.writeLog.bind(this);

    switch (level) {
      default:
      case 'log':
      case 'info':
      case 'warn':
      case 'error':
        const logMessages = Array.isArray(logMessage)
          ? logMessage
          : [logMessage];
        for (const msg of logMessages) {
          let preview = `${msg.message}`;
          if (msg.parameters && queryRunner) {
            // replace all ? with in preview with parameters values, just same what typeorm do
            const [sql] =
              queryRunner.connection.driver.escapeQueryWithParameters(
                preview,
                msg.parameters,
                {},
              );
            preview += `${sql}`;
          }
          const emoji = EmojiLevelMap[level] || '';
          if (emoji) preview = `${emoji} ${preview}`;

          if (msg.additionalInfo?.time) {
            preview =
              `(time: ${msg.additionalInfo.time}ms)` +
              formatQueryString(preview);
          }

          const reactotron = tryGetReadyTron();
          if (!reactotron) {
            return superFn(level, msg, queryRunner);
          }
          tronLog(reactotron, {
            value: {
              parameters: msg.parameters,
              query: msg.message,
              additionalInfo: msg.additionalInfo,
            },
            preview,
          });
        }
        break;
    }
  }

  logRnQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    // if (time >= RnSqlExecutionTimes.rnError) {
    //   const formattedMsg = `[logRnQuerySlow](${time}ms) Slow query detected: """${formatQueryString(query)}""" (params: ${JSON.stringify(parameters)})`;
    //   console.error(formattedMsg);
    // } else if (time >= RnSqlExecutionTimes.rnWarning) {
    //   const formattedMsg = `[logRnQuerySlow](${time}ms) Slow query detected: """${formatQueryString(query)}""" (params: ${JSON.stringify(parameters)})`;
    //   console.warn(formattedMsg);
    // } else if (time >= RnSqlExecutionTimes.config) {
    //   super.logQuerySlow(time, query, parameters, queryRunner);
    // }
    // if (!this.isLogEnabledFor("query-slow")) {
    //   return;
    // }
    const conf = {
      level: 'warn' as LogLevel,
      stage: RnSqlExecutionTimes.rnWarning,
    };

    if (time >= RnSqlExecutionTimes.rnError) {
      conf.level = 'error';
      conf.stage = RnSqlExecutionTimes.rnError;
    } else if (time >= RnSqlExecutionTimes.rnWarning) {
      conf.level = 'warn';
      conf.stage = RnSqlExecutionTimes.rnWarning;
    } else if (time >= RnSqlExecutionTimes.config) {
      conf.level = 'warn';
      conf.stage = RnSqlExecutionTimes.config;
    }

    // const chalk = require('chalk') as typeof import('chalk');

    this.writeLog(
      conf.level,
      makeLogMessages({
        level: conf.level,
        stage: conf.stage,
        time,
        query,
        parameters,
        queryRunner,
      }),
      queryRunner,
    );
  }
}

export class RabbyOrmDeployedConsoleLogger
  extends SimpleConsoleLogger
  implements Logger
{
  constructor(options?: LoggerOptions) {
    super(options);
  }

  #sentryReport(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
    const onlineConfig = getOnlineConfig();
    if (!onlineConfig?.switches?.['20250820.reportSentry_slowQuery']) return;

    try {
      Sentry.captureEvent({
        message: `Slow query detected`,
        level: 'warning',
        extra: {
          time,
          query: formatQueryString(query, 1000),
          parameters,
          queryRunner: queryRunner
            ? {
                poolSize: queryRunner.manager.connection.options.poolSize,
                rnMaxQueryExecutionTime:
                  queryRunner.manager.connection.options
                    .rnMaxQueryExecutionTime,
                maxQueryExecutionTime:
                  queryRunner.manager.connection.options.maxQueryExecutionTime,
                database: queryRunner.manager.connection.options.database,
              }
            : null,
        },
      });
    } catch (error) {
      console.error('Failed to report slow query to Sentry:', error);
    }
  }

  logRnQuerySlow(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ): void {
    this.#sentryReport(time, query, parameters, queryRunner);
  }
}
