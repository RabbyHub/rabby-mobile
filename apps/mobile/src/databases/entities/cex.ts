import 'reflect-metadata';
import { Entity, Column } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { CEX_EXPIRED_TIME } from '@/constant/expireTime';
import { prepareAppDataSource } from '../imports';
import { Cex } from '@rabby-wallet/rabby-api/dist/types';

@Entity('cache_cex')
export class CexEntity extends EntityAddressAssetBase {
  // cexId
  @Column('text')
  cexId: string = '';
  // is_deposit
  @Column('boolean', { default: false })
  is_deposit: boolean = false;
  // name
  @Column('text')
  name: string = '';
  // logo_url
  @Column({
    type: 'text',
  })
  logo_url: string = '';

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}`);
  }

  static fillEntity(
    e: CexEntity,
    owner_addr: string,
    cexId: string,
    isDeposit: boolean,
    name: string,
    logo_url: string,
  ) {
    e.owner_addr = owner_addr;
    e.cexId = cexId;
    e.is_deposit = isDeposit;
    e.name = name;
    e.logo_url = logo_url;
    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('cex')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async queryCexInfo(owner_addr: string): Promise<Cex> {
    await prepareAppDataSource();
    const result = await this.getRepository().findOneBy({
      owner_addr,
    });

    return {
      id: result?.cexId || '',
      is_deposit: result?.is_deposit || false,
      name: result?.name || '',
      logo_url: result?.logo_url || '',
    };
  }

  static async isExpired(owner_addr: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('cex')
      .select('MIN(cex._local_updated_at)', 'minUpdatedAt')
      .where('cex.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > CEX_EXPIRED_TIME;
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
