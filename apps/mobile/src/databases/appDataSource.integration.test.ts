import type { DataSource } from 'typeorm/browser';

import { createMemoryAppDataSource } from '../../test-support/database/createMemoryAppDataSource';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from './constant';
import { BalanceEntity } from './entities/balance';
import { getMigrations } from './migrations';

const OWNER_ADDRESS = '0x0000000000000000000000000000000000000001';

function createBalance(balance: number) {
  const entity = new BalanceEntity();
  BalanceEntity.fillEntity(entity, OWNER_ADDRESS, true, {
    total_usd_value: balance,
    evm_usd_value: balance - 1,
    chain_list: [
      {
        id: 'eth',
        community_id: 1,
        name: 'Ethereum',
        native_token_id: 'eth',
        logo_url: '',
        wrapped_token_id: 'weth',
      },
    ],
  });
  return entity;
}

describe('app database with the Node in-memory SQLite driver', () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    dataSource = undefined;
  });

  it('runs real migrations and repository operations against SQLite', async () => {
    dataSource = await createMemoryAppDataSource();

    const appliedMigrations = await dataSource.query(
      'SELECT name FROM migrations ORDER BY timestamp ASC',
    );
    expect(appliedMigrations.map((row: { name: string }) => row.name)).toEqual(
      getMigrations().map(Migration => Migration.name),
    );

    const tableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_balance}`;
    const tableRows = await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [tableName],
    );
    expect(tableRows).toEqual([{ name: tableName }]);

    const repository = dataSource.getRepository(BalanceEntity);
    await repository.save(createBalance(42));

    const stored = await repository.findOneByOrFail({
      owner_addr: OWNER_ADDRESS,
      isCore: true,
    });
    expect(stored.balance).toBe(42);
    expect(stored.evm_usd_value).toBe(41);
    expect(JSON.parse(stored.chain_list)).toEqual([
      expect.objectContaining({ id: 'eth' }),
    ]);

    await repository.update(stored._db_id, { balance: 84 });
    expect(
      await repository.findOneByOrFail({ _db_id: stored._db_id }),
    ).toMatchObject({ balance: 84 });

    await repository.delete(stored._db_id);
    expect(await repository.count()).toBe(0);
  });

  it('uses real SQLite transactions and primary-key constraints', async () => {
    dataSource = await createMemoryAppDataSource();
    const repository = dataSource.getRepository(BalanceEntity);
    const balance = createBalance(21);

    await expect(
      dataSource.transaction(async manager => {
        await manager.getRepository(BalanceEntity).insert(balance);
        throw new Error('rollback integration probe');
      }),
    ).rejects.toThrow('rollback integration probe');
    expect(await repository.count()).toBe(0);

    await repository.insert(balance);
    await expect(repository.insert(createBalance(22))).rejects.toThrow();
    expect(await repository.count()).toBe(1);
  });
});
