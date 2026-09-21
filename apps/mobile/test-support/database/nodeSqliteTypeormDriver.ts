type DriverRow = Record<string, unknown>;
type DriverRows = DriverRow[] & {
  item(index: number): DriverRow | undefined;
};

type DriverQueryResult = {
  insertId?: number;
  rows: DriverRows;
  rowsAffected: number;
};

type ExecuteSql = (
  sql: string,
  parameters?: unknown[],
  success?: (result: DriverQueryResult) => void,
  failure?: (error: Error) => void,
) => Promise<DriverQueryResult>;

type NodeSqliteStatement = {
  all(
    ...parameters: Array<null | number | bigint | string | Uint8Array>
  ): DriverRow[];
  columns(): unknown[];
  run(...parameters: Array<null | number | bigint | string | Uint8Array>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
};

type NodeSqliteDatabase = {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): NodeSqliteStatement;
};

type NodeSqliteModule = {
  DatabaseSync: new (path: string) => NodeSqliteDatabase;
};

const loadNodeSqlite = async () => {
  // Keep the Node-only integration driver compatible with the repository's
  // older @types/node while using the runtime-provided node:sqlite module.
  const moduleName: string = 'node:sqlite';
  return (await import(moduleName)) as NodeSqliteModule;
};

function normalizeParameter(parameter: unknown) {
  if (parameter === undefined) {
    return null;
  }
  if (typeof parameter === 'boolean') {
    return parameter ? 1 : 0;
  }
  if (parameter instanceof Date) {
    return parameter.toISOString();
  }

  return parameter as null | number | bigint | string | Uint8Array;
}

function makeRows(rows: DriverRow[]): DriverRows {
  const driverRows = rows as DriverRows;
  Object.defineProperty(driverRows, 'item', {
    enumerable: false,
    value(index: number) {
      return driverRows[index];
    },
  });
  return driverRows;
}

function createQueryExecutor(database: NodeSqliteDatabase): ExecuteSql {
  return async (sql, parameters = [], success, failure) => {
    try {
      const statement = database.prepare(sql);
      const normalizedParameters = parameters.map(normalizeParameter);
      const columns = statement.columns();
      let result: DriverQueryResult;

      if (columns.length > 0) {
        result = {
          rows: makeRows(statement.all(...normalizedParameters)),
          rowsAffected: 0,
        };
      } else {
        const runResult = statement.run(...normalizedParameters);
        result = {
          insertId: Number(runResult.lastInsertRowid),
          rows: makeRows([]),
          rowsAffected: Number(runResult.changes),
        };
      }

      success?.(result);
      return result;
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      if (failure) {
        failure(normalizedError);
        // ReactNativeQueryRunner owns the outer Promise when callbacks are
        // provided. Rejecting this otherwise-unobserved driver Promise would
        // create an unhandled rejection in Node.
        return undefined as unknown as DriverQueryResult;
      }
      throw normalizedError;
    }
  };
}

export const nodeMemorySqliteTypeormDriver = {
  openDatabase: async (
    _options: {
      name: string;
      location?: string;
    },
    onOpen?: (connection: unknown) => void,
    onFailure?: (error: Error) => void,
  ) => {
    try {
      const { DatabaseSync } = await loadNodeSqlite();
      const database = new DatabaseSync(':memory:');
      const executeSql = createQueryExecutor(database);
      const connection = {
        getDb: () => database,
        executeSql,
        transaction: async (
          operation: (transaction: { executeSql: ExecuteSql }) => Promise<void>,
        ) => {
          database.exec('BEGIN TRANSACTION');
          try {
            await operation({ executeSql });
            database.exec('COMMIT');
          } catch (error) {
            database.exec('ROLLBACK');
            throw error;
          }
        },
        close: (success: () => void, failure: (error: Error) => void) => {
          try {
            database.close();
            success();
          } catch (error) {
            failure(error instanceof Error ? error : new Error(String(error)));
          }
        },
        attach: () => {
          throw new Error(
            'The Node integration SQLite driver does not support ATTACH.',
          );
        },
        detach: () => {
          throw new Error(
            'The Node integration SQLite driver does not support DETACH.',
          );
        },
      };

      onOpen?.(connection);
      return connection;
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      onFailure?.(normalizedError);
      throw normalizedError;
    }
  },
};
