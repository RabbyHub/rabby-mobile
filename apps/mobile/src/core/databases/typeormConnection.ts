import type {
  DB,
  QueryResult,
  Scalar,
  Transaction,
} from '@op-engineering/op-sqlite';
import type {
  BaseEntity,
  DataSource,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from 'typeorm/browser';
import type { ReactNativeDriver } from 'typeorm/browser/driver/react-native/ReactNativeDriver';

export type TypeormSQLiteConnection = {
  getDb(): DB;
  executeSql<T>(
    sql: string,
    params?: Scalar[],
    success?: (result: QueryResult) => void,
    failure?: (error: unknown) => void,
  ): Promise<T>;
  transaction(
    operation: (transaction: Transaction) => Promise<void>,
  ): Promise<void>;
};

export function resolveDriverAndConnectionFromEntity<
  Entity extends ObjectLiteral,
>(dataSource: DataSource, entityClass: EntityTarget<Entity>) {
  const repository = dataSource.getRepository(entityClass);
  const driver = repository.manager.connection.driver as ReactNativeDriver;

  return {
    driver,
    connection: driver.databaseConnection as TypeormSQLiteConnection,
  };
}

export function resolveDriverAndConnectionFromRepo<T extends BaseEntity>(
  repository: Repository<T>,
) {
  const driver = repository.manager.connection.driver as ReactNativeDriver;

  return {
    driver,
    connection: driver.databaseConnection as TypeormSQLiteConnection,
  };
}
