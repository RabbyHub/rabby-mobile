import 'reflect-metadata';
import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column, In } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_PROTOCOL_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';
import { columnConverter } from './_helpers';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';

@Entity(ORM_TABLE_NAMES.cache_portocolitem)
export class ProtocolItemEntity extends EntityAddressAssetBase {
  // id
  @Column('text', { default: '' })
  id: ComplexProtocol['id'] = '';
  // chain
  @Column('text', { default: '' })
  chain: ComplexProtocol['chain'] = 'eth';
  // name
  @Column('text', { default: '' })
  name: ComplexProtocol['name'] = '';
  // site_url
  @Column('text', { default: '' })
  site_url: ComplexProtocol['site_url'] = '';
  // logo_url
  @Column('text', { default: '' })
  logo_url: ComplexProtocol['logo_url'] = '';
  // has_supported_portfolio
  @Column('boolean', { default: '' })
  has_supported_portfolio: ComplexProtocol['has_supported_portfolio'] = false;
  // tvl
  @Column('real')
  tvl: ComplexProtocol['tvl'] = 0;
  // portfolio_item_list
  @Column({
    type: 'text',
    default: '[]',
  })
  portfolio_item_list: string = '[]';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[this.chain, this.id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: ProtocolItemEntity,
    owner_addr: string,
    input: ComplexProtocol,
  ) {
    e.owner_addr = owner_addr;

    e.id = input.id ?? '';
    e.chain = input.chain ?? '';
    e.name = input.name ?? '';
    e.site_url = input.site_url ?? '';
    e.logo_url = input.logo_url ?? '';
    e.has_supported_portfolio = input.has_supported_portfolio ?? false;
    e.tvl = input.tvl ?? 0;
    e.portfolio_item_list = columnConverter.jsonObjToString(
      input.portfolio_item_list || [],
    );

    e.makeDbId();
  }

  static stmSql = `
  INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_portocolitem}"
  ("_db_id", "owner_addr", "id", "chain", "name", "site_url", "logo_url", "has_supported_portfolio", "tvl", "portfolio_item_list", "_local_created_at", "_local_updated_at")
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT ( "_db_id" ) DO UPDATE SET "_local_updated_at" = EXCLUDED."_local_updated_at"
  `;

  static getStatementSql() {
    return this.stmSql;
  }

  bindUpsertParams(stm: PreparedStatement): PreparedStatement {
    stm.bindSync([
      this._db_id,
      this.owner_addr,
      this.id,
      this.chain,
      this.name,
      this.site_url,
      this.logo_url,
      this.has_supported_portfolio,
      this.tvl,
      this.portfolio_item_list,
      this._local_created_at,
      this._local_updated_at,
    ]);

    return stm;
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('portocolitem')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async batchQueryPortocols(owner_addr: string) {
    await prepareAppDataSource();

    return (await this.getRepository().findBy({ owner_addr }))
      .filter(i => i.id !== EMPTY_PROTOCOL_ITEM_ID)
      .map(i => ({
        ...i,
        portfolio_item_list: columnConverter.jsonStringToObj(
          i.portfolio_item_list,
        ),
      }));
  }

  static async batchMultAddressPortocols(
    addresses: string[],
    maxLength?: number,
  ) {
    await prepareAppDataSource();

    const queryBuilder =
      this.getRepository().createQueryBuilder('portocolitem');

    queryBuilder.andWhere({ owner_addr: In(addresses) });
    if (maxLength) {
      queryBuilder.take(maxLength);
    }

    const portocols = await queryBuilder.getMany();

    return portocols
      .filter(i => i.id !== EMPTY_PROTOCOL_ITEM_ID)
      .map(i => ({
        ...i,
        portfolio_item_list: columnConverter.jsonStringToObj(
          i.portfolio_item_list,
        ),
      }));
  }

  static async isExpired(owner_addr: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('portocolitem')
      .select('MIN(portocolitem._local_updated_at)', 'minUpdatedAt')
      .where('portocolitem.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();
    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > ASSET_EXPIRED_TIME;
  }
  static async willExpired(owner_addr: string, offest?: number) {
    if (await this.isExpired(owner_addr)) {
      return;
    }
    const tenMinutesAgo = Date.now() - ASSET_EXPIRED_TIME + (offest || 0);
    return this.getRepository()
      .createQueryBuilder()
      .update(ProtocolItemEntity)
      .set({ _local_updated_at: tenMinutesAgo })
      .where('owner_addr = :owner_addr', { owner_addr })
      .execute();
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }

  static async cleanupStaleProtocols(
    owner_addr: string,
    syncTimestamp: number,
  ) {
    await prepareAppDataSource();

    const deleteResult = await this.getRepository()
      .createQueryBuilder()
      .delete()
      .from(ProtocolItemEntity)
      .where('owner_addr = :owner_addr', { owner_addr })
      .andWhere('_local_updated_at < :syncTimestamp', { syncTimestamp })
      .execute();

    console.debug(
      `🧹 Cleaned ${
        deleteResult.affected || 0
      } stale protocols for ${owner_addr}`,
    );

    return {
      deletedCount: deleteResult.affected || 0,
      success: true,
    };
  }
}
