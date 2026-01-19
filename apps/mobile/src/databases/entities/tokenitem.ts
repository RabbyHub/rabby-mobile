import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  Entity,
  Column,
  In,
  Brackets,
  Not,
  MoreThan,
  Raw,
} from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import {
  columnConverter,
  badRealTransformer,
  correctBadRealOnSql,
} from './_helpers';
import { ASSET_EXPIRED_TIME } from '@/constant/expireTime';
import { EMPTY_TOKEN_ITEM_ID } from '@/constant/assets';
import { prepareAppDataSource } from '../imports';
import { tokenItemEntityToTokenItem } from '@/utils/token';
import { ITokenItem } from '@/store/tokens';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { PreparedStatement } from '@op-engineering/op-sqlite';

const RawAmountTransformer = {
  to: (val: any) => columnConverter.numberToString(val),
  from: (val: any) => columnConverter.stringToNumber(val, false),
};

@Entity(ORM_TABLE_NAMES.cache_tokenitem)
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
  @Column('boolean', { nullable: true })
  is_core: TokenItem['is_core'] | null = null;
  // is_verified
  @Column('boolean', { nullable: true })
  is_verified: TokenItem['is_verified'] | null = null;
  // is_wallet
  @Column('boolean')
  is_wallet: TokenItem['is_wallet'] = false;
  // is_scam
  // duplicate, use is_suspicious instead
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
  // protocol_id
  @Column('text', { default: '' })
  protocol_id: TokenItem['protocol_id'] = '';
  // raw_amount
  @Column({
    type: 'text',
    default: '',
    transformer: RawAmountTransformer,
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
  // fdv
  @Column('real', { default: 0 })
  fdv: TokenItem['fdv'] = 0;
  @Column('text', { default: '1' })
  value_24h_change: string = '1';
  // cex_ids
  @Column({
    type: 'text',
    default: '[]',
  })
  cex_ids: string = '[]';

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

  static stmSql = `
INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem}"
("_db_id", "owner_addr", "amount", "chain", "decimals", "display_symbol", "id", "is_core", "is_verified", "is_wallet", "is_scam", "is_infinity", "is_suspicious", "logo_url", "name", "optimized_symbol", "price", "symbol", "time_at", "usd_value", "credit_score", "protocol_id", "raw_amount", "raw_amount_hex_str", "price_24h_change", "low_credit_score", "fdv", "content_type", "content", "inner_id", "value_24h_change", "cex_ids", "_local_created_at", "_local_updated_at")
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT ( "_db_id" )
DO UPDATE SET "_local_updated_at" = EXCLUDED."_local_updated_at"
  `;

  static getStatementSql() {
    return this.stmSql;
  }

  bindUpsertParams(stm: PreparedStatement): PreparedStatement {
    stm.bindSync([
      this._db_id,
      this.owner_addr,
      badRealTransformer.to(this.amount),
      this.chain,
      this.decimals,
      this.display_symbol,
      this.id,
      this.is_core,
      this.is_verified,
      this.is_wallet,
      this.is_scam,
      this.is_infinity,
      this.is_suspicious,
      this.logo_url,
      this.name,
      this.optimized_symbol,
      badRealTransformer.to(this.price),
      this.symbol,
      this.time_at,
      this.usd_value,
      this.credit_score,
      this.protocol_id,
      RawAmountTransformer.to(this.raw_amount),
      this.raw_amount_hex_str,
      this.price_24h_change,
      this.low_credit_score,
      this.fdv,
      this.content_type || '',
      this.content,
      this.inner_id,
      this.value_24h_change,
      this.cex_ids,
      this._local_created_at,
      this._local_updated_at,
    ]);

    return stm;
  }

  static fillEntity(
    e: TokenItemEntity,
    owner_addr: string,
    input: (TokenItem | ITokenItem) & {
      value_24h_change?: string;
      cex_ids?: string[];
    },
  ) {
    e.owner_addr = owner_addr;

    e.content_type = input.content_type;
    e.content = input.content ?? '';
    e.inner_id = input.inner_id ?? '';
    e.amount = input.amount ?? 0;
    e.chain = input.chain ?? '';
    e.decimals = input.decimals ?? 18;
    e.credit_score = input.credit_score ?? 0;
    e.display_symbol = input.display_symbol ?? '';
    e.id = input.id ?? '';
    e.is_core = input.is_core ?? null;
    e.is_verified = input.is_verified ?? null;
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
    e.cex_ids = columnConverter.jsonObjToString(input.cex_ids || []);
    e.fdv = input.fdv ?? 0;
    e.protocol_id = input.protocol_id ?? '';

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

    const queryBuilder = this.getRepository().createQueryBuilder('tokenitem');
    queryBuilder
      .where({
        owner_addr,
        id: Not(EMPTY_TOKEN_ITEM_ID),
      })
      .andWhere(`tokenitem.amount > :amount`, { amount: 0 });

    return (await queryBuilder.getMany()).map(i => ({
      ...i,
      cex_ids: columnConverter.jsonStringToObj(i.cex_ids),
    }));
  }

  static async batchMultiAddressTokensByIdAndChain(
    addresses: string[],
    chain: string,
    token_id: string,
  ) {
    await prepareAppDataSource();

    const res = (
      await this.getRepository().findBy({
        owner_addr: In(addresses),
        chain,
        id: token_id,
      })
    )
      .filter(i => i.amount > 0)
      .map(i => ({
        ...i,
        cex_ids: columnConverter.jsonStringToObj(i.cex_ids),
      }));

    return res;
  }

  static async batchMultiAddressTokens(
    addresses: string[],
    core?: boolean,
    maxLength?: number,
  ) {
    await prepareAppDataSource();

    const queryBuilder = this.getRepository().createQueryBuilder('tokenitem');

    queryBuilder.andWhere({ owner_addr: In(addresses) });

    if (core) {
      queryBuilder.andWhere({ is_core: true });
    }
    if (maxLength) {
      queryBuilder.take(maxLength);
    }

    const tokens = await queryBuilder
      .where({
        id: Not(EMPTY_TOKEN_ITEM_ID),
        // amount: Raw(alias => `${alias} > 0`),
      })
      .andWhere(`tokenitem.amount > :amount`, { amount: 0 })
      .getMany();

    return (
      tokens
        // .filter(i => i.id !== EMPTY_TOKEN_ITEM_ID)
        // .filter(i => i.amount > 0)
        .map(i => ({
          ...i,
          cex_ids: columnConverter.jsonStringToObj(i.cex_ids),
        }))
    );
  }

  static async getDefaultTokensByAddresses(
    addresses: string[],
  ): Promise<Record<string, ITokenItem[]>> {
    await prepareAppDataSource();
    const owner_addr_list = [
      ...new Set(addresses.map(addr => addr.toLowerCase())),
    ];
    if (!owner_addr_list.length) {
      return {};
    }

    const repo = this.getRepository();
    const tableName = repo.metadata.tableName;
    const subQueryColumns = repo.metadata.columns.map(col => {
      if (['amount', 'price'].includes(col.databaseName)) {
        return `${correctBadRealOnSql(
          `tokenitem.${col.databaseName}` as
            | 'tokenitem.amount'
            | 'tokenitem.price',
        )} AS "${col.databaseName}"`;
      }
      return `"${col.databaseName}"`;
    });
    const outerSelectColumns = repo.metadata.columns.map(
      col => `"${col.databaseName}"`,
    );
    const usdValueOrderExpr = `(${correctBadRealOnSql(
      'tokenitem.price',
    )} * ${correctBadRealOnSql('tokenitem.amount')})`;

    const placeholders = owner_addr_list.map(() => '?').join(',');
    const params: any[] = [...owner_addr_list, EMPTY_TOKEN_ITEM_ID, 20];
    const sql = `
      SELECT ${outerSelectColumns.join(', ')}
      FROM (
        SELECT ${subQueryColumns.join(', ')},
               ROW_NUMBER() OVER (PARTITION BY owner_addr ORDER BY ${usdValueOrderExpr} DESC) AS rn
        FROM "${tableName}" tokenitem
        WHERE owner_addr IN (${placeholders})
          AND is_core = 1
          AND id != ?
          AND amount > 0
      ) tokenitem
      WHERE tokenitem.rn <= ?
    `;

    const rows = await repo.query(sql, params);

    const result: Record<string, ITokenItem[]> = {};
    rows.forEach(row => {
      const key = row.owner_addr;
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(tokenItemEntityToTokenItem(row));
    });

    return result;
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

    queryBuilder
      .where({
        id: Not(EMPTY_TOKEN_ITEM_ID),
        // amount: Raw(alias => `${alias} > 0`),
      })
      .andWhere(`tokenitem.amount > :amount`, { amount: 0 });

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

    const tokens = await queryBuilder.getMany();
    return (
      tokens
        // .filter(i => i.id !== EMPTY_TOKEN_ITEM_ID)
        // .filter(i => i.amount > 0)
        .map(i => ({
          ...i,
          cex_ids: columnConverter.jsonStringToObj(i.cex_ids),
        }))
    );
  }

  static async queryTokensByOwner(
    owner_addrs: string | string[],
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

    const owner_addr_list = [
      ...new Set(
        (Array.isArray(owner_addrs) ? owner_addrs : [owner_addrs]).map(addr =>
          addr.toLowerCase(),
        ),
      ),
    ];
    const repo = this.getRepository();
    const queryBuilder = repo
      .createQueryBuilder('tokenitem')
      .where({
        owner_addr: In(owner_addr_list),
        is_core: true,
        id: Not(EMPTY_TOKEN_ITEM_ID),
        // amount: Raw(alias => `${alias} > 0`),
      })
      .andWhere(`tokenitem.amount > :amount`, { amount: 0 })
      .select([
        // TODO: which need customized sqlite drivers
        // `"tokenitem"."raw_amount" / pow(10, tokenitem.decimals) AS tokenitme_token_amount`,
        `(${correctBadRealOnSql('tokenitem.price')} * ${correctBadRealOnSql(
          'tokenitem.amount',
        )}) AS tokenitem_token_usd_value`,
        'tokenitem',
      ])
      .orderBy('tokenitem_token_usd_value', 'DESC');

    if (filter_tokenGte10Dollar) {
      queryBuilder.andWhere('tokenitem_token_usd_value >= 10');
    }

    if (filter_tokenProportionGte10Percent) {
      const loggerPrefix = `[queryTokensByOwner::${
        repo.metadata.tableName
      }::${owner_addr_list.join(',')}]`;
      // notice: result[0]?.total_value maybe null is there's no any record about owner_addr
      const result = await repo
        .query(
          // `SELECT SUM( ${correctBadRealOnSql('tokenitem.price')} * ("tokenitem"."raw_amount" / pow(10, tokenitem.decimals)) ) AS total_value
          `SELECT SUM( ${correctBadRealOnSql(
            'tokenitem.price',
          )} * ${correctBadRealOnSql('tokenitem.amount')} ) AS total_value
        FROM "${repo.metadata.tableName}" "tokenitem"
        WHERE owner_addr IN(${owner_addr_list
          .map(() => '?')
          .join(',')}) AND is_core = 1`,
          owner_addr_list,
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

    if (topCount) {
      queryBuilder.take(topCount);
    }
    const tokens = await queryBuilder.getMany();
    return (
      tokens
        // .filter(i => i.id !== EMPTY_TOKEN_ITEM_ID)
        // .filter(i => i.amount > 0)
        .map(i => ({
          ...i,
          cex_ids: columnConverter.jsonStringToObj(i.cex_ids),
        }))
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

  static async getCexIds(tokenId: string, chain: string) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('tokenitem')
      .select('tokenitem.cex_ids', 'cex_ids')
      .where('tokenitem.id = :tokenId', { tokenId })
      .andWhere('tokenitem.chain = :chain', { chain })
      .getOne();

    return {
      find: !!result,
      cex_ids: columnConverter.jsonStringToObj(result?.cex_ids || '[]'),
    };
  }

  // 获取原生代币列表中美元总价值最大的一个token
  static async getTokenWithMaxUsdValue(
    owner_addr: string,
    tokenList: { chain: string; tokenId: string }[],
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const chainAndTokenIds = tokenList.map(item => ({
      chain: item.chain,
      id: item.tokenId,
    }));
    const result = await repo
      .createQueryBuilder('tokenitem')
      .select([
        `(${correctBadRealOnSql('tokenitem.price')} * ${correctBadRealOnSql(
          'tokenitem.amount',
        )}) AS tokenitem_token_usd_value`,
        'tokenitem',
      ])
      .where('tokenitem.owner_addr = :owner_addr', { owner_addr })
      .andWhere(
        chainAndTokenIds.length > 0
          ? 'tokenitem.chain IN (:...chains) AND tokenitem.id IN (:...tokenIds)'
          : '1=1',
        {
          chains: chainAndTokenIds.map(item => item.chain),
          tokenIds: chainAndTokenIds.map(item => item.id),
        },
      )
      .andWhere('tokenitem.is_core = 1')
      .orderBy('tokenitem_token_usd_value', 'DESC')
      .take(1)
      .getOne();

    return result;
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }

  static async deleteForAddressAndToken(owner_addr: string, tokenId: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr, id: tokenId });
  }

  // delete tokens that are not updated in last batch reload token list
  static async cleanupStaleTokens(owner_addr: string, syncTimestamp: number) {
    try {
      await prepareAppDataSource();
      const repo = this.getRepository();
      const currentTime = Date.now();
      const deleteResult = await repo
        .createQueryBuilder()
        .delete()
        .from(TokenItemEntity)
        .where('owner_addr = :owner_addr', { owner_addr })
        .andWhere('_local_updated_at < :syncTimestamp', { syncTimestamp })
        .execute();

      console.debug(
        `🧹 Cleaned ${
          deleteResult.affected || 0
        } stale tokens for ${owner_addr}`,
        'time:',
        Date.now() - currentTime,
      );

      return {
        deletedCount: deleteResult.affected || 0,
        success: true,
      };
    } catch (error) {
      console.error(
        `❌ Failed to cleanup stale tokens for ${owner_addr}:`,
        error,
      );
      throw error;
    }
  }

  static async getTokenListAmount({
    owner_addr,
    tokenList,
  }: {
    owner_addr: string[];
    tokenList: { chain: string; tokenId: string }[];
  }): Promise<Array<{ chain: string; tokenId: string; amount: number }>> {
    try {
      await prepareAppDataSource();

      if (!owner_addr.length || !tokenList.length) {
        return [];
      }

      const repo = this.getRepository();
      const whereConditions = tokenList.map((token, index) => {
        const chainParam = `chain${index}`;
        const tokenIdParam = `tokenId${index}`;
        return `(tokenitem.chain = :${chainParam} AND tokenitem.id = :${tokenIdParam})`;
      });

      const params: Record<string, any> = {};
      tokenList.forEach((token, index) => {
        params[`chain${index}`] = token.chain;
        params[`tokenId${index}`] = token.tokenId;
      });

      const result = await repo
        .createQueryBuilder('tokenitem')
        .select([
          'tokenitem.chain',
          'tokenitem.id',
          `SUM(${correctBadRealOnSql('tokenitem.amount')}) as total_amount`,
        ])
        .where(`tokenitem.owner_addr IN (:...owner_addr)`, { owner_addr })
        .andWhere(`(${whereConditions.join(' OR ')})`, params)
        .groupBy('tokenitem.chain, tokenitem.id')
        .getRawMany();

      const amountMap = new Map<string, number>();
      result.forEach(item => {
        const key = `${item.tokenitem_chain}-${item.tokenitem_id}`;
        amountMap.set(key, parseFloat(item.total_amount) || 0);
      });

      return tokenList.map(token => {
        const key = `${token.chain}-${token.tokenId}`;
        return {
          chain: token.chain,
          tokenId: token.tokenId,
          amount: amountMap.get(key) || 0,
        };
      });
    } catch (error) {
      console.error('Failed to get token list amount:', error);
      throw error;
    }
  }
  static async getAddressesAmount({
    address,
    chain,
    tokenId,
  }: {
    address: string;
    chain: TokenItem['chain'];
    tokenId: TokenItem['id'];
  }): Promise<{
    amount: number;
    success: boolean;
  }> {
    try {
      await prepareAppDataSource();

      if (!address) {
        return {
          amount: 0,
          success: false,
        };
      }

      const repo = this.getRepository();
      const result = await repo
        .createQueryBuilder('tokenitem')
        .select(
          `SUM(${correctBadRealOnSql('tokenitem.amount')}) as total_amount`,
        )
        .where('tokenitem.owner_addr = :address', { address })
        .andWhere('tokenitem.chain = :chain', { chain })
        .andWhere('tokenitem.id = :tokenId', { tokenId })
        .getRawOne();

      return {
        amount: parseFloat(result?.total_amount) || 0,
        success: !!result,
      };
    } catch (error) {
      console.error('Failed to get addresses amount:', error);
      return {
        amount: 0,
        success: false,
      };
    }
  }
}
