import 'reflect-metadata';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { BALANCE_EXPIRED_TIME } from '@/constant/expireTime';
import { prepareAppDataSource } from '../imports';
import { columnConverter } from './_helpers';
import type { EvmTotalBalanceResponse } from '../hooks/balance';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { ParseEntity } from '@/core/utils/typeorm';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';
import {
  executeStartupSqlite,
  getStartupSqliteRowItem,
  getStartupSqliteRowsLength,
} from '../startupSqlite';

type StartupBalanceCacheEntry = {
  owner_addr: string;
  isCore: boolean;
};

function buildStartupBalanceCacheKey(ownerAddr: string, isCore: boolean) {
  return `${ownerAddr.toLowerCase()}-${isCore ? 'core' : 'nocore'}`;
}

@ParseEntity()
@Entity(ORM_TABLE_NAMES.cache_balance)
export class BalanceEntity extends EntityAddressAssetBase {
  // balance
  @Column('real')
  balance: number = 0;
  // evm balance
  @Column('real', { default: 0 })
  evm_usd_value: number = 0;
  // is_core
  @Column('boolean', { default: false })
  isCore: boolean = false;
  // chain_list
  @Column({
    type: 'text',
    default: '[]',
  })
  chain_list: string = '[]';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${
      this.isCore ? 'core' : 'nocore'
    }`);
  }

  static fillEntity(
    e: BalanceEntity,
    owner_addr: string,
    isCore: boolean,
    input: EvmTotalBalanceResponse,
  ) {
    e.owner_addr = owner_addr;
    e.balance = input.total_usd_value;
    e.evm_usd_value = input.evm_usd_value || 0;
    e.chain_list = columnConverter.jsonObjToString(input.chain_list || []);
    e.isCore = !!isCore;
    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('balance')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async queryBalance(
    owner_addr: string,
    isCore: boolean,
  ): Promise<EvmTotalBalanceResponse> {
    const cache = await this.queryBalanceCache(owner_addr, isCore);

    return (
      cache || {
        total_usd_value: 0,
        evm_usd_value: 0,
        chain_list: [],
      }
    );
  }

  static async queryBalanceCache(
    owner_addr: string,
    isCore: boolean,
  ): Promise<EvmTotalBalanceResponse | null> {
    await prepareAppDataSource();
    const result = await this.getRepository().findOneBy({
      owner_addr,
      isCore,
    });

    if (!result) {
      return null;
    }

    return {
      total_usd_value: result?.balance || 0,
      evm_usd_value: result?.evm_usd_value || 0,
      chain_list:
        columnConverter.jsonStringToObj(result?.chain_list || '[]') || [],
    };
  }

  static async queryBalanceCacheMapForStartup(
    entries: StartupBalanceCacheEntry[],
  ): Promise<Record<string, EvmTotalBalanceResponse>> {
    const normalizedEntries = entries.map(entry => ({
      owner_addr: entry.owner_addr.toLowerCase(),
      isCore: !!entry.isCore,
    }));
    const addresses = Array.from(
      new Set(normalizedEntries.map(entry => entry.owner_addr)),
    );

    if (!addresses.length) {
      return {};
    }

    const startedAt = Date.now();
    const tableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_balance}`;
    const placeholders = addresses.map(() => '?').join(',');

    try {
      const result = await executeStartupSqlite(
        `
          SELECT owner_addr, balance, evm_usd_value, isCore, chain_list, _local_updated_at
          FROM "${tableName}"
          WHERE lower(owner_addr) IN (${placeholders})
          ORDER BY _local_updated_at DESC
        `,
        addresses,
      );
      const rows = result.rows;
      const rowCount = getStartupSqliteRowsLength(rows);
      const entrySet = new Set(
        normalizedEntries.map(entry =>
          buildStartupBalanceCacheKey(entry.owner_addr, entry.isCore),
        ),
      );
      const ret: Record<string, EvmTotalBalanceResponse> = {};

      for (let index = 0; index < rowCount; index++) {
        const row = getStartupSqliteRowItem(rows, index);
        if (!row?.owner_addr) {
          continue;
        }

        const key = buildStartupBalanceCacheKey(
          String(row.owner_addr),
          !!row.isCore,
        );
        if (!entrySet.has(key) || ret[key]) {
          continue;
        }

        ret[key] = {
          total_usd_value: Number(row.balance) || 0,
          evm_usd_value: Number(row.evm_usd_value) || 0,
          chain_list:
            columnConverter.jsonStringToObj(row.chain_list || '[]') || [],
        };
      }

      traceStartupDiagnostic('db', 'balance_startup_cache_fast_read', {
        addressCount: addresses.length,
        rowCount,
        hitCount: Object.keys(ret).length,
        durationMs: Date.now() - startedAt,
      });

      return ret;
    } catch (error) {
      traceStartupDiagnostic('db', 'balance_startup_cache_fast_read_failed', {
        addressCount: addresses.length,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });

      return {};
    }
  }

  static async queryAllBalance() {
    await prepareAppDataSource();
    const result = await this.getRepository().find();

    // 数据订正：如果有多个 owner_addr 相同（大小写不敏感）的条目，只保留 update_at 最新的那个
    const deduplicatedResult = Object.values(
      result.reduce((acc, item) => {
        const key = item.owner_addr.toLowerCase();
        if (!acc[key] || item._local_updated_at > acc[key]._local_updated_at) {
          acc[key] = item;
        }
        return acc;
      }, {} as Record<string, (typeof result)[number]>),
    );

    return deduplicatedResult.map(item => ({
      ...item,
      chain_list:
        columnConverter.jsonStringToObj(item.chain_list || '[]') || [],
    })) as Array<
      Omit<BalanceEntity, 'chain_list'> & {
        chain_list: EvmTotalBalanceResponse['chain_list'];
      }
    >;
  }

  static async queryChainList(
    address: string,
  ): Promise<EvmTotalBalanceResponse['chain_list']> {
    if (!address) {
      return [];
    }

    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo.findOne({
      where: {
        owner_addr: address,
      },
      select: {
        chain_list: true,
      },
    });

    return columnConverter.jsonStringToObj(result?.chain_list || '[]') || [];
  }

  static async isExpired(owner_addr: string, isCore: boolean) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('balance')
      .select('MIN(balance._local_updated_at)', 'minUpdatedAt')
      .where('balance.owner_addr = :owner_addr', { owner_addr })
      .andWhere('balance.isCore = :isCore', { isCore })
      .getRawOne();

    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > BALANCE_EXPIRED_TIME;
  }
  static async willExpired(owner_addr: string, offest?: number) {
    if (await this.isExpired(owner_addr, true)) {
      return;
    }
    // 3mins + offest age
    const expiredTime = Date.now() - BALANCE_EXPIRED_TIME + (offest || 0);
    return this.getRepository()
      .createQueryBuilder()
      .update(BalanceEntity)
      .set({ _local_updated_at: expiredTime })
      .where('owner_addr = :owner_addr', { owner_addr })
      .execute();
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
  static async deleteForAddressCore(owner_addr: string, isCore: boolean) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr, isCore });
  }
}
