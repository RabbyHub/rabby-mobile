import 'reflect-metadata';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { prepareAppDataSource } from '../imports';
import { TokenItemEntity } from './tokenitem';

@Entity('copy_trading_buyitem')
export class CopyTradingBuyItemEntity extends EntityAddressAssetBase {
  // amount
  @Column('real')
  amount: number = 0;
  // chain
  @Column('text', { default: '' })
  chain: TokenItem['chain'] = 'eth';
  // id
  @Column('text', { default: '' })
  id: TokenItem['id'] = '';
  // price
  @Column('real')
  price: TokenItem['price'] = 0;

  @Column('integer')
  recently_buy_time: number = 0;

  makeDbId(): string {
    return (this._db_id = `${[this.owner_addr, this.id, this.chain]
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
      recently_buy_time?: number;
    },
  ) {
    e.owner_addr = owner_addr;

    e.amount = input.amount ?? 0;
    e.chain = input.chain ?? '';
    e.id = input.id ?? '';
    e.price = input.price ?? 0;
    e.recently_buy_time =
      input.recently_buy_time ?? Math.floor(Date.now() / 1000);

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

  /**
   * Insert or update CopyTradingBuyItem record
   * If same record exists (owner_addr + id + chain), accumulate amount and calculate weighted average price
   * If not exists, insert new record
   * @param owner_addr wallet address
   * @param tokenData token data
   */
  static async insertOrUpdateBuyItem(
    owner_addr: string,
    tokenData: {
      id: string;
      chain: string;
      amount: number;
      price: number;
    },
  ) {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // 1. Check if same record exists
    const existingRecord = await repo.findOne({
      where: {
        owner_addr,
        id: tokenData.id,
        chain: tokenData.chain,
      },
    });

    if (existingRecord) {
      // 2. Record exists: accumulate amount and calculate weighted average price
      const oldAmount = existingRecord.amount;
      const oldPrice = existingRecord.price;
      const newAmount = tokenData.amount;
      const newPrice = tokenData.price;

      // Calculate total amount
      const totalAmount = oldAmount + newAmount;

      // Calculate weighted average price: (old_amount * old_price + new_amount * new_price) / total_amount
      const weightedAveragePrice =
        (oldAmount * oldPrice + newAmount * newPrice) / totalAmount;

      // Update record
      await repo.update(
        {
          owner_addr,
          id: tokenData.id,
          chain: tokenData.chain,
        },
        {
          amount: totalAmount,
          price: weightedAveragePrice,
          recently_buy_time: currentTimestamp,
        },
      );

      console.log(
        `Update record: ${tokenData.id}, old amount: ${oldAmount}, new: ${newAmount}, total: ${totalAmount}, weighted price: ${weightedAveragePrice}`,
      );

      return {
        action: 'updated' as const,
        record: {
          ...existingRecord,
          amount: totalAmount,
          price: weightedAveragePrice,
          recently_buy_time: currentTimestamp,
        },
      };
    } else {
      // 3. Record not exists: insert new record
      const newRecord = new CopyTradingBuyItemEntity();
      this.fillEntity(newRecord, owner_addr, {
        ...tokenData,
        recently_buy_time: currentTimestamp,
      });

      const savedRecord = await repo.save(newRecord);

      console.log(
        `Insert new record: ${tokenData.id}, amount: ${tokenData.amount}, price: ${tokenData.price}`,
      );

      return {
        action: 'inserted' as const,
        record: savedRecord,
      };
    }
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
        AND ct.recently_buy_time < ${oneHourAgo}
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

    // Use join query to get valid records at once
    const queryStartTime = Date.now();
    const validRecords = await repo.query(`
      SELECT 
        token.*,
        ct.amount as buy_amount,
        ct.price as buy_price
      FROM copy_trading_tokenitem ct
      INNER JOIN cache_tokenitem token
        ON ct.id = token.id 
        AND ct.chain = token.chain 
        AND ct.owner_addr = token.owner_addr
      WHERE token.amount > 0
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
