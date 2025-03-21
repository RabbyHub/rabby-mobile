import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column, In } from 'typeorm';
import { EntityAddressAssetBase } from './base';
import {
  columnConverter,
  badRealTransformer,
  correctBadRealOnSql,
} from './_helpers';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_TOKEN_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';
import { Brackets, Not } from 'typeorm/browser';

@Entity('cache_tokenitem')
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
    transformer: badRealTransformer,
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
    transformer: badRealTransformer,
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
  // credit_score
  @Column('real', { default: 0 })
  credit_score: TokenItem['credit_score'] = 0;
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

  @Column('text', { default: '1' })
  value_24h_change: string = '1';

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

  static fillEntity(
    e: TokenItemEntity,
    owner_addr: string,
    input: TokenItem & { value_24h_change?: string },
  ) {
    e.owner_addr = owner_addr;

    // content_type, content, inner_id, amount, chain, decimals, display_symbol, id, is_core, is_verified, is_wallet, is_scam, is_infinity, is_suspicious, logo_url, name, optimized_symbol, price, symbol, time_at, usd_value, raw_amount, raw_amount_hex_str, price_24h_change, low_credit_score
    e.content_type = input.content_type;
    e.content = input.content ?? '';
    e.inner_id = input.inner_id ?? '';
    e.amount = input.amount ?? 0;
    e.chain = input.chain ?? '';
    e.decimals = input.decimals ?? 18;
    e.credit_score = input.credit_score ?? 0;
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
    e.value_24h_change = input.value_24h_change ?? '1';

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

  static async batchMultAddressTokens(addresses: string[]) {
    await prepareAppDataSource();

    return (
      await this.getRepository().findBy({
        owner_addr: In(addresses),
        is_core: true,
        is_scam: false,
      })
    ).filter(i => i.id !== EMPTY_TOKEN_ITEM_ID);
  }

  /**
   * @description query tokens, order by tokenitem_token_usd_value DESC by default
   */
  static async searchAllTokens(options?: {
    /**
     * @description vary with owner_addr, default is false
     */
    addresses?: string[];
    only_core_token?: boolean;
    /**
     * @todo support filter by chain
     */
    chain_server_id?: string;
    /**
     * @todo support match keyword on id/symbol/optimized_symbol/...
     */
    keyword?: string;
  }) {
    await prepareAppDataSource();

    const {
      addresses,
      only_core_token = false,
      chain_server_id,
      keyword,
    } = options || {};

    const repo = this.getRepository();
    const queryBuilder = repo.createQueryBuilder('tokenitem');

    queryBuilder.where({ id: Not(EMPTY_TOKEN_ITEM_ID) });

    if (addresses) {
      queryBuilder.andWhere({ owner_addr: In(addresses) });
    }
    if (only_core_token) {
      queryBuilder.andWhere({ is_core: true });
    }
    if (chain_server_id) {
      queryBuilder.andWhere({ chain: chain_server_id });
    }
    if (keyword) {
      queryBuilder.andWhere(
        new Brackets(qb => {
          qb.where('tokenitem.chain LIKE :keyword', {
            keyword: `%${keyword}%`,
          });
          qb.orWhere('tokenitem.name LIKE :keyword', {
            keyword: `${keyword}%`,
          });
          qb.orWhere('tokenitem.symbol LIKE :keyword', {
            keyword: `${keyword}%`,
          });
          qb.orWhere('tokenitem.optimized_symbol LIKE :keyword', {
            keyword: `${keyword}%`,
          });
          qb.orWhere('tokenitem.display_symbol LIKE :keyword', {
            keyword: `${keyword}%`,
          });
          qb.orWhere('tokenitem.id LIKE :keyword', {
            keyword: `${keyword}%`,
          });
        }),
      );
    }

    queryBuilder
      .select([
        `(${correctBadRealOnSql('tokenitem.price')} * ${correctBadRealOnSql(
          'tokenitem.amount',
        )}) AS tokenitem_token_usd_value`,
        'tokenitem',
      ])
      .orderBy('tokenitem_token_usd_value', 'DESC');

    return queryBuilder.getMany();
  }

  static async queryTokensByOwner(
    owner_addr: string,
    options?: {
      topCount?: number | false;
      /** @default true */
      filter_tokenGte10Dollar?: boolean;
      /** @default true */
      filter_tokenProportionGte10Percent?: boolean;
      // excludeTokenIds?: string[]
    },
  ) {
    await prepareAppDataSource();

    let {
      topCount = 5,
      filter_tokenGte10Dollar = true,
      filter_tokenProportionGte10Percent = true,
      // excludeTokenIds = []
    } = options || {};
    topCount = Math.max(0, topCount || 0);

    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('tokenitem')
      .where({ owner_addr, is_core: true, id: Not(EMPTY_TOKEN_ITEM_ID) })
      .select([
        // TODO: which need customized sqlite drivers
        // `"tokenitem"."raw_amount" / pow(10, tokenitem.decimals) AS tokenitme_token_amount`,
        `(${correctBadRealOnSql('tokenitem.price')} * ${correctBadRealOnSql(
          'tokenitem.amount',
        )}) AS tokenitem_token_usd_value`,
        'tokenitem',
      ])
      .orderBy('tokenitem_token_usd_value', 'DESC');

    if (filter_tokenGte10Dollar)
      queryBuilder.andWhere(`tokenitem_token_usd_value >= 10`);

    if (filter_tokenProportionGte10Percent) {
      const loggerPrefix = `[queryTokensByOwner::${repo.metadata.tableName}::${owner_addr}]`;
      // notice: result[0]?.total_value maybe null is there's no any record about owner_addr
      const result = await repo
        .query(
          // `SELECT SUM( ${correctBadRealOnSql('tokenitem.price')} * ("tokenitem"."raw_amount" / pow(10, tokenitem.decimals)) ) AS total_value
          `SELECT SUM( ${correctBadRealOnSql(
            'tokenitem.price',
          )} * ${correctBadRealOnSql('tokenitem.amount')} ) AS total_value
        FROM "${repo.metadata.tableName}" "tokenitem"
        WHERE owner_addr = '${owner_addr}' AND is_core = 1`,
        )
        .catch(error => {
          console.error(`${loggerPrefix} error on get total_value`, error);
          return [{ total_value: NaN }];
        });

      const totalValue = result[0]?.total_value;
      if (typeof totalValue !== 'number' || !totalValue) {
        console.debug(
          `${loggerPrefix} don't queried valid total_value (result: ${JSON.stringify(
            result,
          )}), will not filter by tokenProportionGte10Percent`,
        );
      } else if (Number.isNaN(totalValue)) {
        console.warn(
          `${loggerPrefix} totalValue is NaN, will not filter by tokenProportionGte10Percent`,
        );
      } else {
        queryBuilder.andWhere(
          `(tokenitem_token_usd_value / ${totalValue}) >= 0.1`,
        );
      }
    }

    // if (excludeTokenIds?.length) {
    //   queryBuilder.andWhere(`tokenitem.id NOT IN (:...excludeTokenIds)`, { excludeTokenIds });
    // }

    if (topCount) queryBuilder.take(topCount);

    return queryBuilder.getMany();
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
