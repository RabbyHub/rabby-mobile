import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { prepareAppDataSource } from '../imports';
import { TokenItemEntity } from './tokenitem';

@Entity('copy_trading_buyitem')
export class CopyTradingBuyItemEntity extends EntityAddressAssetBase {
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
    e.create_time = Math.floor(Date.now() / 1000);

    e.makeDbId();
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();

    const result = await repo
      .createQueryBuilder('copy_trading_buyitem')
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
    },
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const newRecord = new CopyTradingBuyItemEntity();
    this.fillEntity(newRecord, owner_addr, tokenData);

    await repo.save(newRecord);

    return true;
  }

  static async deleteExpiredBuyItem() {
    const repo = this.getRepository();

    // Get all invalid records (need to delete)
    // Only delete invalid records older than 1 hour (3600 seconds)
    const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
    const invalidRecords = await repo.query(`
      SELECT ct._db_id
      FROM copy_trading_buyitem ct
      LEFT JOIN cache_tokenitem token 
        ON ct.id = token.id 
        AND ct.chain = token.chain 
        AND ct.owner_addr = token.owner_addr
      WHERE (token.id IS NULL OR token.amount = 0)
        AND ct.create_time < ${oneHourAgo}
    `);

    // Delete invalid records
    if (invalidRecords.length > 0) {
      const invalidIds = invalidRecords.map(
        (record: CopyTradingBuyItemEntity) => record._db_id,
      );
      try {
        await repo
          .createQueryBuilder()
          .delete()
          .from(CopyTradingBuyItemEntity)
          .where('_db_id IN (:...invalidIds)', { invalidIds })
          .execute();

        console.log(
          `Successfully deleted ${invalidIds.length} invalid CopyTradingBuyItem records`,
        );
      } catch (error) {
        console.error(
          'Error deleting invalid CopyTradingBuyItem records:',
          error,
        );
      }
    }
  }

  /**
   * Optimized version: use native SQL for join query with better performance
   * @returns raw SQL query results containing TokenItem fields plus buy_amount and buy_price
   */
  static async queryCopyTradingItems(): Promise<
    (TokenItemEntity & { buy_amount: number; buy_price: number })[]
  > {
    await prepareAppDataSource();

    const repo = this.getRepository();

    // Use aggregated join query to calculate weighted average price for same token
    // buy_price = (from_token_amount * from_token_price) / amount
    const queryStartTime = Date.now();
    const validRecords = await repo.query(`
      SELECT 
        token.*,
        SUM(ct.amount) as buy_amount,
        SUM(ct.from_token_amount * ct.from_token_price) / SUM(ct.amount) as buy_price
      FROM copy_trading_tokenitem ct
      INNER JOIN cache_tokenitem token
        ON ct.id = token.id 
        AND ct.chain = token.chain 
        AND ct.owner_addr = token.owner_addr
      WHERE token.amount > 0
      GROUP BY ct.id, ct.chain, ct.owner_addr
    `);
    const queryEndTime = Date.now();

    console.log(
      `Database query time: ${
        queryEndTime - queryStartTime
      }ms, Records found: ${validRecords.length}`,
    );

    return validRecords;
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
 * // ]
 */
