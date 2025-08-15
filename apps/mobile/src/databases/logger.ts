import * as Sentry from '@sentry/react-native';
import {
  Logger,
  QueryRunner,
  AdvancedConsoleLogger,
  SimpleConsoleLogger,
  LoggerOptions,
  AbstractLogger,
  LogLevel,
} from 'typeorm/browser';

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

export class RabbyOrmDevConsoleLogger
  extends AdvancedConsoleLogger
  implements Logger
{
  constructor(options?: LoggerOptions) {
    super(options);
  }

  stringifyParams(parameters: any) {
    try {
      return formatQueryString(JSON.stringify(parameters, null, 2), 300);
    } catch (error) {
      // most probably circular objects in parameters
      return parameters;
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

  async #sentryReport(
    time: number,
    query: string,
    parameters?: any[],
    queryRunner?: QueryRunner,
  ) {
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
