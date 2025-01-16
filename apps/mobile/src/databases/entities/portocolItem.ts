import 'reflect-metadata';
import { ComplexProtocol } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { jsonTransformer } from './_helpers';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_PROTOCOL_ITEM_ID } from '@/constant/assets';

@Entity('portocolitem')
export class PortocolItemEntity extends EntityAddressAssetBase {
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
    default: '{}',
    transformer: jsonTransformer,
  })
  portfolio_item_list: string = '{}';

  makeDbId(): string {
    return (this._db_id = `${this.address}-${[this.chain, this.id]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: PortocolItemEntity,
    address: string,
    input: ComplexProtocol,
  ) {
    e.address = address;

    e.id = input.id ?? '';
    e.chain = input.chain ?? '';
    e.name = input.name ?? '';
    e.site_url = input.site_url ?? '';
    e.logo_url = input.logo_url ?? '';
    e.has_supported_portfolio = input.has_supported_portfolio ?? false;
    e.tvl = input.tvl ?? 0;
    e.portfolio_item_list = JSON.stringify(input.portfolio_item_list || {});

    e.makeDbId();
  }

  static async getCountOfAccount() {
    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('portocolitem')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    return this.getRepository().count();
  }

  static async batchQueryPortocols(address: string) {
    return (await this.getRepository().findBy({ address }))
      .filter(i => i.id !== EMPTY_PROTOCOL_ITEM_ID)
      .map(i => ({
        ...i,
        portfolio_item_list: JSON.parse(i.portfolio_item_list || '{}'),
      }));
  }

  static async isExpired(address: string) {
    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('portocolitem')
      .select('MIN(portocolitem._local_updated_at)', 'minUpdatedAt')
      .where('portocolitem.address = :address', { address })
      .getRawOne();
    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > ASSET_EXPIRED_TIME;
  }
  static async deleteForAddress(address: string) {
    return this.getRepository().delete({ address });
  }
}
