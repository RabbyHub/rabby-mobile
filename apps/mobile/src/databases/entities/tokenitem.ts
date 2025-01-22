import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import { columnConverter, realTransformer } from './_helpers';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_TOKEN_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';

@Entity('tokenitem')
export class TokenItemEntity extends EntityAddressAssetBase {
  // content_type
  @Column('text', { default: '' })
  content_type: TokenItem['content_type'];
  // content
  @Column('text', { default: '' })
  content: TokenItem['content'];
  // inner_id
  @Column('text', { default: '' })
  inner_id: TokenItem['inner_id'];
  // amount
  @Column({
    default: 0,
    type: 'integer',
    transformer: realTransformer,
  })
  amount: TokenItem['amount'] = 0;
  // chain
  @Column('text', { default: '' })
  chain: TokenItem['chain'] = 'eth';
  // decimals
  @Column('real')
  decimals: TokenItem['decimals'] = 18;
  // display_symbol
  @Column('text', { default: '' })
  display_symbol: TokenItem['display_symbol'] = 'ETH';
  // id
  @Column('text', { default: '' })
  id: TokenItem['id'] = '';
  // is_core
  @Column('boolean')
  is_core: TokenItem['is_core'] = false;
  // is_verified
  @Column('boolean')
  is_verified: TokenItem['is_verified'] = false;
  // is_wallet
  @Column('boolean')
  is_wallet: TokenItem['is_wallet'] = false;
  // is_scam
  @Column('boolean')
  is_scam: TokenItem['is_scam'] = false;
  // is_infinity
  @Column('boolean')
  is_infinity: TokenItem['is_infinity'] = false;
  // is_suspicious
  @Column('boolean')
  is_suspicious: TokenItem['is_suspicious'] = false;
  // logo_url
  @Column('text', { default: '' })
  logo_url: TokenItem['logo_url'] = '';
  // name
  @Column('text', { default: '' })
  name: TokenItem['name'] = '';
  // optimized_symbol
  @Column('text', { default: '' })
  optimized_symbol: TokenItem['optimized_symbol'] = '';
  // price
  @Column('real', {
    transformer: realTransformer,
  })
  price: TokenItem['price'] = 0;
  // symbol
  @Column('text', { default: '' })
  symbol: TokenItem['symbol'] = '';
  // time_at
  @Column('integer')
  time_at: TokenItem['time_at'] = 0;
  // usd_value
  @Column('real')
  usd_value: TokenItem['usd_value'] = 0;
  // raw_amount
  @Column({
    type: 'text',
    default: '',
    transformer: {
      to: (val: any) => columnConverter.numberToString(val),
      from: (val: any) => columnConverter.stringToNumber(val, false),
    },
  })
  raw_amount: TokenItem['raw_amount'] = '';
  // raw_amount_hex_str
  @Column('text', { default: '' })
  raw_amount_hex_str: TokenItem['raw_amount_hex_str'] = '';
  // price_24h_change
  @Column('real')
  price_24h_change: TokenItem['price_24h_change'] = 0;
  // low_credit_score
  @Column('boolean')
  low_credit_score: TokenItem['low_credit_score'] = false;

  makeDbId(): string {
    return (this._db_id = `${[
      this.owner_addr,
      this.id,
      this.chain,
      this.inner_id || '',
    ]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(e: TokenItemEntity, owner_addr: string, input: TokenItem) {
    e.owner_addr = owner_addr;

    // content_type, content, inner_id, amount, chain, decimals, display_symbol, id, is_core, is_verified, is_wallet, is_scam, is_infinity, is_suspicious, logo_url, name, optimized_symbol, price, symbol, time_at, usd_value, raw_amount, raw_amount_hex_str, price_24h_change, low_credit_score
    e.content_type = input.content_type;
    e.content = input.content ?? '';
    e.inner_id = input.inner_id ?? '';
    e.amount = input.amount ?? 0;
    e.chain = input.chain ?? '';
    e.decimals = input.decimals ?? 18;
    e.display_symbol = input.display_symbol ?? '';
    e.id = input.id ?? '';
    e.is_core = input.is_core ?? false;
    e.is_verified = input.is_verified ?? false;
    e.is_wallet = input.is_wallet ?? false;
    e.is_scam = input.is_scam ?? false;
    e.is_infinity = input.is_infinity ?? false;
    e.is_suspicious = input.is_suspicious ?? false;
    e.logo_url = input.logo_url ?? '';
    e.name = input.name ?? '';
    e.optimized_symbol = input.optimized_symbol ?? '';
    e.price = input.price ?? 0;
    e.symbol = input.symbol ?? '';
    e.time_at = input.time_at ?? 0;
    e.usd_value = input.usd_value ?? 0;
    e.raw_amount = input.raw_amount;
    e.raw_amount_hex_str = input.raw_amount_hex_str ?? '';
    e.price_24h_change = input.price_24h_change ?? 0;
    e.low_credit_score = input.low_credit_score ?? false;

    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('tokenitem')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async batchQueryTokens(owner_addr: string) {
    await prepareAppDataSource();

    return (await this.getRepository().findBy({ owner_addr })).filter(
      i => i.id !== EMPTY_TOKEN_ITEM_ID,
    );
  }

  static async isExpired(owner_addr: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('tokenitem')
      .select('MIN(tokenitem._local_updated_at)', 'minUpdatedAt')
      .where('tokenitem.owner_addr = :owner_addr', { owner_addr })
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
      .update(TokenItemEntity)
      .set({ _local_updated_at: tenMinutesAgo })
      .where('owner_addr = :owner_addr', { owner_addr })
      .execute();
  }
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }
}
