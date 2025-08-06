import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { prepareAppDataSource } from '../imports';
import { TokenItemEntity } from './tokenitem';
import { DECIMALS_INT_RATIO } from './_helpers';

const TABLE_NAME = 'rabby_copy_trading_buyitem';
const TABLE_NAME_TOKENITEM = 'rabby_cache_tokenitem';

export type QueryCopyTradingBuyItemResult = TokenItemEntity & {
  buy_amount: number;
  buy_price: number;
  realAmount: number; // min(amount, buy_amount)
  holdingUsdValue: number; // min(amount, buy_amount) * price
};

@Entity('copy_trading_buyitem')
export class CopyTradingBuyItemEntity extends EntityAddressAssetBase {
  // hash
  @Column('text', { default: '' })
  hash: string = '';
  // chain
  @Column('text', { default: '' })
  chain: TokenItem['chain'] = 'eth';
  // amount
  @Column('real')
  amount: number = 0;
  // id
  @Column('text', { default: '' })
  id: TokenItem['id'] = '';
  // price
  @Column('real')
  price: TokenItem['price'] = 0;

  // from_token_id
  @Column('text', { default: '' })
  from_token_id: TokenItem['id'] = '';

  // from_token_amount
  @Column('real')
  from_token_amount: number = 0;

  // from_token_price
  @Column('real')
  from_token_price: number = 0;

  // create_time
  @Column('integer')
  create_time: number = 0;

  makeDbId(): string {
    return (this._db_id = `${[
      this.owner_addr,
      this.id,
      this.chain,
      this.create_time,
    ]
      .filter(Boolean)
      .join('-')}`);
  }

  static fillEntity(
    e: CopyTradingBuyItemEntity,
    owner_addr: string,
    input: {
      amount: number;
      chain: string;
      id: string;
      price: number;
      from_token_id: string;
      from_token_amount: number;
      from_token_price: number;
      hash: string;
    },
  ) {
    e.owner_addr = owner_addr;

    e.amount = input.amount ?? 0;
    e.chain = input.chain ?? '';
    e.id = input.id ?? '';
    e.price = input.price ?? 0;

    e.from_token_id = input.from_token_id ?? '';
    e.from_token_amount = input.from_token_amount ?? 0;
    e.from_token_price = input.from_token_price ?? 0;
    e.hash = input.hash ?? '';
    e.create_time = Math.floor(Date.now() / 1000);

    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder()
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueChainAddressCount')
      .getRawOne();

    return result.uniqueChainAddressCount as number;
  }

  static async getCount() {
    await prepareAppDataSource();

    return this.getRepository().count();
  }

  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();

    return this.getRepository().delete({ owner_addr });
  }

  static async selectAllBuyItem() {
    await prepareAppDataSource();

    return this.getRepository().find();
  }

  static async insertBuyItem(
    owner_addr: string,
    tokenData: {
      id: string;
      chain: string;
      amount: number;
      price: number;
      from_token_id: string;
      from_token_amount: number;
      from_token_price: number;
      hash: string;
    },
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const newRecord = new CopyTradingBuyItemEntity();
    this.fillEntity(newRecord, owner_addr, tokenData);

    await repo.save(newRecord);
    console.log('insertCopyTradingBuyItem success', newRecord);
    return true;
  }

  static async deleteExpiredBuyItem() {
    try {
      await prepareAppDataSource();
      const repo = this.getRepository();

      // Get all invalid records (need to delete)
      // Only delete invalid records older than 1 hour (3600 seconds)
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      const invalidRecords = await repo.query(`
        SELECT ct._db_id
        FROM ${TABLE_NAME} ct
        LEFT JOIN ${TABLE_NAME_TOKENITEM} token
          ON ct.id = token.id
          AND ct.chain = token.chain
          AND ct.owner_addr = token.owner_addr
        WHERE (token.id IS NULL OR token.amount = 0)
          AND ct.create_time < ${oneHourAgo}
      `);

      // improve multi check delete logic
      if (invalidRecords.length > 0) {
        const invalidIds = invalidRecords.map(record => record._db_id);

        // second check, wait 60 seconds
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));

        // second check
        const secondCheckInvalidRecords = await repo.query(
          `
          SELECT ct._db_id
          FROM ${TABLE_NAME} ct
          LEFT JOIN ${TABLE_NAME_TOKENITEM} token
            ON ct.id = token.id
            AND ct.chain = token.chain
            AND ct.owner_addr = token.owner_addr
          WHERE ct._db_id IN (${invalidIds.map(() => '?').join(',')})
            AND (token.id IS NULL OR token.amount = 0)
        `,
          invalidIds,
        );

        // only delete records that are confirmed invalid after two checks
        if (secondCheckInvalidRecords.length > 0) {
          const confirmedInvalidIds = secondCheckInvalidRecords.map(
            record => record._db_id,
          );

          console.log(
            `Copy Trading cleanup: Found ${invalidIds.length} initially invalid records, confirmed ${confirmedInvalidIds.length} for deletion`,
          );

          await repo
            .createQueryBuilder()
            .delete()
            .from(CopyTradingBuyItemEntity)
            .where('_db_id IN (:...confirmedInvalidIds)', {
              confirmedInvalidIds,
            })
            .execute();

          console.log(
            `Copy Trading cleanup: Successfully deleted ${confirmedInvalidIds.length} invalid records`,
          );
        } else {
          console.log(
            'Copy Trading cleanup: No records confirmed for deletion after second check',
          );
        }
      }
    } catch (e) {
      console.error('Error deleting expired CopyTradingBuyItem:', e);
    }
  }

  /**
   * Optimized version: use CTE to first aggregate CopyTradingBuyItem, then join with TokenItem
   * @returns raw SQL query results containing TokenItem fields plus buy_amount and buy_price
   */

  static async queryCopyTradingItems(): Promise<
    QueryCopyTradingBuyItemResult[]
  > {
    try {
      await prepareAppDataSource();

      const repo = this.getRepository();

      // Use CTE to first aggregate CopyTradingBuyItem, then join with TokenItem
      // This ensures token.amount is the actual current holding
      const queryStartTime = Date.now();
      const validRecords = await repo.query(`
        WITH aggregated_buys AS (
          SELECT
            id,
            chain,
            owner_addr,
            SUM(amount) as buy_amount,
            SUM(from_token_amount * from_token_price) / SUM(amount) as buy_price
          FROM ${TABLE_NAME}
          GROUP BY id, chain, owner_addr
        )
        SELECT
          tokenitem.*,
          ab.buy_amount,
          ab.buy_price
        FROM aggregated_buys ab
        INNER JOIN ${TABLE_NAME_TOKENITEM} tokenitem
          ON ab.id = tokenitem.id
          AND ab.chain = tokenitem.chain 
          AND ab.owner_addr = tokenitem.owner_addr
        WHERE tokenitem.amount > 0
      `);
      const queryEndTime = Date.now();

      // Fix amount and price values using the same logic as badRealTransformer
      const correctedRecords = validRecords.map(record => ({
        ...record,
        amount: record.amount / DECIMALS_INT_RATIO, // Correct the stored value
        price: record.price / DECIMALS_INT_RATIO, // Correct the stored value
        realAmount: Math.min(
          record.amount / DECIMALS_INT_RATIO,
          record.buy_amount,
        ),
        holdingUsdValue:
          Math.min(record.amount / DECIMALS_INT_RATIO, record.buy_amount) *
          (record.price / DECIMALS_INT_RATIO),
      }));

      console.log(
        `Database query time: ${
          queryEndTime - queryStartTime
        }ms, Records found: ${correctedRecords.length}`,
      );

      return correctedRecords;
    } catch (error) {
      console.error('Error querying CopyTradingBuyItem:', error);
      return [];
    }
  }
}

/**
 * Usage examples:
 *
 * Use native SQL approach (better performance, recommended)
 * const optimizedResults = await CopyTradingBuyItemEntity.queryCopyTradingItems();
 * console.log('Optimized results:', optimizedResults);
 *
 * // Returned data structure example:
 * // [
 * //   {
 * //     _db_id: "0x1234...-token_id-eth",
 * //     owner_addr: "0x1234...",
 * //     id: "token_id",
 * //     chain: "eth",
 * //     amount: 100,           //  hold amount in cache_tokenitem
 * //     price: 1.5,            // current price in cache_tokenitem
 * //     ...other TokenItem fields
 * //     buy_amount: 50.5,      // purchase amount in copy_trading_buyitem
 * //     buy_price: 2.0,        // purchase price in copy_trading_buyitem
 * //     // ... other fields
 * //   }
 * //
 */
