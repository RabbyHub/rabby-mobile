import {
  EntitySchema,
  type DataSource,
  type DataSourceOptions,
} from 'typeorm/browser';

import { isNonPublicProductionEnv } from '@/constant';
import { createOpSqliteTypeORMDriver } from '@/core/databases/op-sqlite/typeorm';
import { APP_DB_PREFIX } from './constant';
import { initializeConfiguredDataSource } from './dataSourceLifecycle';
import { getMigrations } from './migrations';

type NativeMemoryContractEntity = {
  id: string;
  value: number;
};

const NativeMemoryContractSchema = new EntitySchema<NativeMemoryContractEntity>(
  {
    name: 'NativeMemoryContractEntity',
    tableName: 'native_memory_contract',
    columns: {
      id: {
        type: 'text',
        primary: true,
      },
      value: {
        type: 'real',
      },
    },
  },
);

export type NativeMemoryAppDataSourceContractResult = {
  passed: boolean;
  driver: 'op-sqlite';
  storage: ':memory:';
  migrationCount: number;
  repositoryValue: number;
  transactionRolledBack: boolean;
  integrityCheck: string | null;
  journalMode: string | null;
  durationMs: number;
};

let runningContract:
  | Promise<NativeMemoryAppDataSourceContractResult>
  | undefined;

async function executeNativeMemoryAppDataSourceContract(): Promise<NativeMemoryAppDataSourceContractResult> {
  if (!isNonPublicProductionEnv) {
    throw new Error(
      'The native in-memory SQLite contract is only available in non-production builds.',
    );
  }

  const startedAt = Date.now();
  let memoryDataSource: DataSource | undefined;

  const memoryDataSourceOptions: DataSourceOptions = {
    type: 'react-native',
    database: 'rabby-native-memory-contract.db',
    location: ':memory:',
    logging: false,
    synchronize: false,
    driver: createOpSqliteTypeORMDriver({ publishLifecycle: false }),
    entityPrefix: APP_DB_PREFIX,
    // Keep the native probe isolated from business BaseEntity classes. A
    // second DataSource would otherwise rebind their static repositories while
    // the app is still running.
    entities: [NativeMemoryContractSchema],
    migrations: getMigrations(),
  };

  try {
    memoryDataSource = await initializeConfiguredDataSource(
      memoryDataSourceOptions,
      {
        journalMode: 'MEMORY',
        migrationFailurePolicy: 'throw',
      },
    );

    const migrationRows: { name: string }[] = await memoryDataSource.query(
      'SELECT name FROM migrations ORDER BY timestamp ASC',
    );
    const repository = memoryDataSource.getRepository(
      NativeMemoryContractSchema,
    );

    await repository.save({ id: 'probe', value: 42 });
    const stored = await repository.findOneByOrFail({ id: 'probe' });

    let transactionRolledBack = false;
    try {
      await memoryDataSource.transaction(async manager => {
        await manager
          .getRepository(NativeMemoryContractSchema)
          .update('probe', { value: 84 });
        throw new Error('native memory transaction rollback probe');
      });
    } catch (error) {
      transactionRolledBack =
        error instanceof Error &&
        error.message === 'native memory transaction rollback probe';
    }

    const afterRollback = await repository.findOneByOrFail({
      id: 'probe',
    });
    const integrityRows: { integrity_check: string }[] =
      await memoryDataSource.query('PRAGMA integrity_check');
    const journalRows: { journal_mode: string }[] =
      await memoryDataSource.query('PRAGMA journal_mode');

    const passed =
      migrationRows.length === getMigrations().length &&
      stored.value === 42 &&
      transactionRolledBack &&
      afterRollback.value === 42 &&
      integrityRows[0]?.integrity_check === 'ok';

    return {
      passed,
      driver: 'op-sqlite',
      storage: ':memory:',
      migrationCount: migrationRows.length,
      repositoryValue: stored.value,
      transactionRolledBack,
      integrityCheck: integrityRows[0]?.integrity_check || null,
      journalMode: journalRows[0]?.journal_mode || null,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (memoryDataSource?.isInitialized) {
      await memoryDataSource.destroy();
    }
  }
}

export function runNativeMemoryAppDataSourceContract() {
  if (!runningContract) {
    runningContract = executeNativeMemoryAppDataSourceContract().finally(() => {
      runningContract = undefined;
    });
  }

  return runningContract;
}
