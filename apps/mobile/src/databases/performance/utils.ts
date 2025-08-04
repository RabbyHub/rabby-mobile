import { dbQueryMonitor } from './dbQueryMonitor';
import { Repository } from 'typeorm/browser';

/**
 * 监控Repository查询操作
 */
export async function monitorRepositoryQuery<T>(
  repo: Repository<any>,
  operation: () => Promise<T>,
  options: {
    entity?: string;
    method?: string;
    query?: string;
  } = {},
): Promise<T> {
  return dbQueryMonitor.monitorQuery(operation, {
    entity: options.entity || repo.metadata.name,
    method: options.method || 'repository_query',
    query: options.query || 'repository_operation',
  });
}

/**
 * 监控原始SQL查询
 */
export async function monitorRawSQLQuery<T>(
  dataSource: any,
  sql: string,
  params?: any[],
  options: {
    entity?: string;
    method?: string;
  } = {},
): Promise<T> {
  return dbQueryMonitor.monitorQuery(() => dataSource.query(sql, params), {
    query: sql,
    entity: options.entity || 'DataSource',
    method: options.method || 'raw_query',
  });
}

/**
 * 监控QueryBuilder查询
 */
export async function monitorQueryBuilder<T>(
  queryBuilder: any,
  operation: () => Promise<T>,
  options: {
    entity?: string;
    method?: string;
  } = {},
): Promise<T> {
  const sql = queryBuilder.getSql ? queryBuilder.getSql() : 'query_builder';

  return dbQueryMonitor.monitorQuery(operation, {
    query: sql,
    entity: options.entity || 'QueryBuilder',
    method: options.method || 'query_builder',
  });
}

/**
 * 创建带监控的Repository包装器
 */
export function createMonitoredRepository<T>(
  repo: Repository<T>,
  entityName?: string,
) {
  const monitoredRepo = {
    ...repo,

    // 监控find操作
    async find(options?: any): Promise<T[]> {
      return monitorRepositoryQuery(repo, () => repo.find(options), {
        entity: entityName || repo.metadata.name,
        method: 'find',
        query: 'find_all',
      });
    },

    // 监控findBy操作
    async findBy(options: any): Promise<T[]> {
      return monitorRepositoryQuery(repo, () => repo.findBy(options), {
        entity: entityName || repo.metadata.name,
        method: 'findBy',
        query: 'find_by_conditions',
      });
    },

    // 监控findOneBy操作
    async findOneBy(options: any): Promise<T | null> {
      return monitorRepositoryQuery(repo, () => repo.findOneBy(options), {
        entity: entityName || repo.metadata.name,
        method: 'findOneBy',
        query: 'find_one_by_conditions',
      });
    },

    // 监控count操作
    async count(options?: any): Promise<number> {
      return monitorRepositoryQuery(repo, () => repo.count(options), {
        entity: entityName || repo.metadata.name,
        method: 'count',
        query: 'count_records',
      });
    },

    // 监控save操作
    async save(entity: T | T[]): Promise<T | T[]> {
      return monitorRepositoryQuery(repo, () => repo.save(entity), {
        entity: entityName || repo.metadata.name,
        method: 'save',
        query: 'save_entity',
      });
    },

    // 监控delete操作
    async delete(criteria: any): Promise<any> {
      return monitorRepositoryQuery(repo, () => repo.delete(criteria), {
        entity: entityName || repo.metadata.name,
        method: 'delete',
        query: 'delete_records',
      });
    },

    // 监控clear操作
    async clear(): Promise<void> {
      return monitorRepositoryQuery(repo, () => repo.clear(), {
        entity: entityName || repo.metadata.name,
        method: 'clear',
        query: 'clear_all',
      });
    },

    // 监控createQueryBuilder操作
    createQueryBuilder(alias?: string) {
      const queryBuilder = repo.createQueryBuilder(alias);

      // 包装getMany方法
      const originalGetMany = queryBuilder.getMany.bind(queryBuilder);
      queryBuilder.getMany = async () => {
        return monitorQueryBuilder(queryBuilder, originalGetMany, {
          entity: entityName || repo.metadata.name,
          method: 'getMany',
        });
      };

      // 包装getOne方法
      const originalGetOne = queryBuilder.getOne.bind(queryBuilder);
      queryBuilder.getOne = async () => {
        return monitorQueryBuilder(queryBuilder, originalGetOne, {
          entity: entityName || repo.metadata.name,
          method: 'getOne',
        });
      };

      // 包装getCount方法
      const originalGetCount = queryBuilder.getCount.bind(queryBuilder);
      queryBuilder.getCount = async () => {
        return monitorQueryBuilder(queryBuilder, originalGetCount, {
          entity: entityName || repo.metadata.name,
          method: 'getCount',
        });
      };

      return queryBuilder;
    },

    // 监控query操作
    async query(sql: string, parameters?: any[]): Promise<any> {
      return monitorRepositoryQuery(repo, () => repo.query(sql, parameters), {
        entity: entityName || repo.metadata.name,
        method: 'query',
        query: sql,
      });
    },
  };

  return monitoredRepo;
}
