import 'reflect-metadata';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { realTransformer } from './_helpers';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_NFT_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';
import { safeParseJSON } from '@rabby-wallet/base-utils/dist/isomorphic/string';

@Entity('nftitem')
export class NFTItemEntity extends EntityAddressAssetBase {
  // chain
  @Column('text', { default: '' })
  chain: NFTItem['chain'] = 'eth';
  // id
  @Column('text', { default: '' })
  id: NFTItem['id'] = '';
  // contract_id
  @Column('text', { default: '' })
  contract_id: NFTItem['contract_id'] = '';
  // inner_id
  @Column('text', { default: '' })
  inner_id: NFTItem['inner_id'] = '';
  // token_id
  @Column('text', { default: '' })
  token_id: NFTItem['token_id'] = '';
  // name
  @Column('text', { default: '' })
  name: NFTItem['name'] = '';
  // contract_name
  @Column('text', { default: '' })
  contract_name: NFTItem['contract_name'] = '';
  // collection_name
  @Column('text', { default: '' })
  collection_name: NFTItem['collection_name'] = '';
  // description
  @Column('text', { default: '' })
  description: NFTItem['description'] = '';
  // usd_price
  @Column('real')
  usd_price: NFTItem['usd_price'] = 0;
  // amount
  @Column({
    default: 0,
    type: 'integer',
    transformer: realTransformer,
  })
  amount: NFTItem['amount'] = 0;
  // collection_id
  @Column('text', { default: '' })
  collection_id: NFTItem['collection_id'] = '';
  // content_type
  @Column('text', { default: '' })
  content_type: NFTItem['content_type'] = 'image_url';
  // content
  @Column('text', { default: '' })
  content: NFTItem['content'] = '';
  // detail_url
  @Column('text', { default: '' })
  detail_url: NFTItem['detail_url'] = '';
  // total_supply
  @Column('text', { default: '' })
  total_supply: NFTItem['total_supply'] = '';
  // is_erc1155
  @Column('boolean', { default: '' })
  is_erc1155: NFTItem['is_erc1155'] = false;
  // is_erc721
  @Column('boolean', { default: '' })
  is_erc721: NFTItem['is_erc721'] = false;
  // is_core
  @Column('boolean', { default: false })
  is_core: NFTItem['is_core'] = false;
  // thumbnail_url
  @Column('text', { default: '' })
  thumbnail_url: NFTItem['thumbnail_url'] = '';
  // pay_token
  @Column({
    type: 'text',
    default: '{}',
  })
  pay_token: string = '{}';
  // collection
  @Column({
    type: 'text',
    default: '{}',
  })
  collection: string = '{}';
  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${[
      this.chain,
      this.id,
      this.token_id,
    ]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(e: NFTItemEntity, owner_addr: string, input: NFTItem) {
    e.owner_addr = owner_addr;

    e.chain = input.chain ?? '';
    e.id = input.id ?? '';
    e.contract_id = input.contract_id ?? '';
    e.inner_id = input.inner_id ?? '';
    e.token_id = input.token_id ?? '';
    e.name = input.name ?? '';
    e.contract_name = input.contract_name ?? '';
    e.description = input.description ?? '';
    e.usd_price = input.usd_price ?? 0;
    e.amount = input.amount ?? 0;
    e.collection_id = input.contract_id ?? '';
    e.content_type = input.content_type || 'image_url';
    e.content = input.content ?? '';
    e.detail_url = input.detail_url ?? '';
    e.total_supply = input.total_supply ?? '';
    e.collection = JSON.stringify(input.collection || {});
    e.pay_token = JSON.stringify(input.pay_token || {});
    e.is_erc1155 = input.is_erc1155 ?? false;
    e.is_erc721 = input.is_erc721 ?? false;
    e.thumbnail_url = input.thumbnail_url ?? '';
    e.collection_name = input.collection_name ?? '';
    e.is_core = input.is_core ?? false;
    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('nftitem')
      .select('COUNT(DISTINCT (`address`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async batchQueryNFTs(owner_addr: string) {
    await prepareAppDataSource();

    return (
      await this.getRepository().findBy({
        owner_addr,
      })
    )
      .filter(i => i.id !== EMPTY_NFT_ITEM_ID)
      .map(i => ({
        ...i,
        collection: safeParseJSON(i.collection),
        pay_token: safeParseJSON(i.pay_token),
      }));
  }
  static async willExpired(owner_addr: string, offest?: number) {
    if (await this.isExpired(owner_addr)) {
      return;
    }
    const tenMinutesAgo = Date.now() - ASSET_EXPIRED_TIME + (offest || 0);
    return this.getRepository()
      .createQueryBuilder()
      .update(NFTItemEntity)
      .set({ _local_updated_at: tenMinutesAgo })
      .where('owner_addr = :owner_addr', { owner_addr })
      .execute();
  }

  static async isExpired(owner_addr: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('nftitem')
      .select('MIN(nftitem._local_updated_at)', 'minUpdatedAt')
      .where('nftitem.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    if (!result.minUpdatedAt) {
      return true;
    }
    const firstUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - firstUpdateTime > ASSET_EXPIRED_TIME;
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
