import 'reflect-metadata';
import {
  AppChainItem,
  PortfolioItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { Entity, Column, In } from 'typeorm/browser';
import { EntityAddressAssetBase } from './base';
import { jsonTransformer } from './_helpers';
import { prepareAppDataSource } from '../imports';
import { ORM_TABLE_NAMES } from '../constant';
import { ParseEntity } from '@/core/utils/typeorm';

// AppChain 数据过期时间：10分钟
export const APPCHAIN_EXPIRED_TIME = 10 * 60 * 1000;

@ParseEntity()
@Entity(ORM_TABLE_NAMES.cache_appchain)
export class AppChainEntity extends EntityAddressAssetBase {
  // id - AppChain 的唯一标识
  @Column('text', { default: '' })
  id: AppChainItem['id'] = '';

  // name - AppChain 名称
  @Column('text', { default: '' })
  name: AppChainItem['name'] = '';

  // site_url - 站点 URL
  @Column('text', { default: '' })
  site_url: AppChainItem['site_url'] = '';

  // logo_url - Logo URL
  @Column('text', { default: '' })
  logo_url: AppChainItem['logo_url'] = '';

  // is_support_portfolio - 是否支持 portfolio
  @Column('boolean', { default: false })
  is_support_portfolio: AppChainItem['is_support_portfolio'] = false;

  // is_visible - 是否可见
  @Column('boolean', { default: true })
  is_visible: AppChainItem['is_visible'] = true;

  // portfolio_item_list - portfolio 列表（JSON 序列化存储）
  @Column({
    type: 'text',
    default: '[]',
    transformer: jsonTransformer,
  })
  portfolio_item_list: PortfolioItem[] = [];

  // 计算的 USD 总价值（用于排序和快速查询）
  @Column('real', { default: 0 })
  usd_value: number = 0;

  makeDbId(): string {
    return (this._db_id = `${this.owner_addr}-${this.id}`);
  }

  static fillEntity(
    e: AppChainEntity,
    owner_addr: string,
    input: AppChainItem,
  ) {
    e.owner_addr = owner_addr;
    e.id = input.id ?? '';
    e.name = input.name ?? '';
    e.site_url = input.site_url ?? '';
    e.logo_url = input.logo_url ?? '';
    e.is_support_portfolio = input.is_support_portfolio ?? false;
    e.is_visible = input.is_visible ?? true;
    e.portfolio_item_list = input.portfolio_item_list ?? [];

    // 计算总 USD 价值
    e.usd_value = (input.portfolio_item_list ?? []).reduce((acc, item) => {
      return acc + (item.stats?.net_usd_value ?? 0);
    }, 0);

    e.makeDbId();
  }

  static async getCount() {
    await prepareAppDataSource();
    return this.getRepository().count();
  }

  /**
   * 查询所有 AppChain（用于初始化缓存）
   */
  static async queryAll(): Promise<AppChainEntity[]> {
    await prepareAppDataSource();
    return this.getRepository().find({
      order: { usd_value: 'DESC' },
    });
  }

  static async getCountOfAccount() {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('appchain')
      .select('COUNT(DISTINCT (`owner_addr`))', 'uniqueOwnerCount')
      .getRawOne();

    return (result?.uniqueOwnerCount ?? 0) as number;
  }

  /**
   * 查询指定地址的所有 AppChain
   */
  static async queryByOwner(owner_addr: string): Promise<AppChainItem[]> {
    await prepareAppDataSource();

    const results = await this.getRepository().find({
      where: { owner_addr },
      order: { usd_value: 'DESC' },
    });

    return results.map(e => ({
      id: e.id,
      name: e.name,
      site_url: e.site_url,
      logo_url: e.logo_url,
      is_support_portfolio: e.is_support_portfolio,
      is_visible: e.is_visible,
      portfolio_item_list: e.portfolio_item_list,
    }));
  }

  /**
   * 批量查询多个地址的 AppChain
   */
  static async queryByOwners(
    owner_addrs: string[],
  ): Promise<Record<string, AppChainItem[]>> {
    await prepareAppDataSource();

    if (!owner_addrs.length) {
      return {};
    }

    const results = await this.getRepository().find({
      where: { owner_addr: In(owner_addrs) },
      order: { usd_value: 'DESC' },
    });

    const grouped: Record<string, AppChainItem[]> = {};
    for (const e of results) {
      if (!grouped[e.owner_addr]) {
        grouped[e.owner_addr] = [];
      }
      const appChainItem: AppChainItem = {
        id: e.id,
        name: e.name,
        site_url: e.site_url,
        logo_url: e.logo_url,
        is_support_portfolio: e.is_support_portfolio,
        is_visible: e.is_visible,
        portfolio_item_list: e.portfolio_item_list,
      };
      grouped[e.owner_addr]!.push(appChainItem);
    }

    return grouped;
  }

  /**
   * 查询指定地址的总 USD 价值
   */
  static async queryTotalUsdValue(owner_addr: string): Promise<number> {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('appchain')
      .select('SUM(appchain.usd_value)', 'totalUsdValue')
      .where('appchain.owner_addr = :owner_addr', { owner_addr })
      .getRawOne();

    return result?.totalUsdValue ?? 0;
  }

  /**
   * 删除指定地址的所有 AppChain 数据
   */
  static async deleteForAddress(owner_addr: string) {
    await prepareAppDataSource();
    return this.getRepository().delete({ owner_addr });
  }

  /**
   * 删除指定地址的特定 AppChain
   */
  static async deleteForAddressAndId(owner_addr: string, appId: string) {
    await prepareAppDataSource();
    return this.getRepository().delete({ owner_addr, id: appId });
  }

  /**
   * 检查指定地址的 AppChain 数据是否过期
   * 如果任意一条记录的更新时间超过 10 分钟，则认为数据过期
   */
  static async isExpired(owner_addr: string): Promise<boolean> {
    await prepareAppDataSource();

    const repo = this.getRepository();
    const result = await repo
      .createQueryBuilder('appchain')
      .select('MIN(appchain._local_updated_at)', 'minUpdatedAt')
      .where('appchain.owner_addr = :owner_addr', {
        owner_addr: owner_addr.toLowerCase(),
      })
      .getRawOne();

    // 如果没有数据，认为过期
    if (!result?.minUpdatedAt) {
      return true;
    }

    const minUpdateTime = parseInt(result.minUpdatedAt, 10);
    return Date.now() - minUpdateTime > APPCHAIN_EXPIRED_TIME;
  }

  /**
   * 清理过期的 AppChain 数据
   */
  static async cleanupStaleAppChains(
    owner_addr: string,
    syncTimestamp: number,
  ) {
    try {
      await prepareAppDataSource();
      const repo = this.getRepository();

      const deleteResult = await repo
        .createQueryBuilder()
        .delete()
        .from(AppChainEntity)
        .where('owner_addr = :owner_addr', { owner_addr })
        .andWhere('_local_updated_at < :syncTimestamp', { syncTimestamp })
        .execute();

      return {
        deletedCount: deleteResult.affected || 0,
        success: true,
      };
    } catch (error) {
      console.error(
        `Failed to cleanup stale appchains for ${owner_addr}:`,
        error,
      );
      throw error;
    }
  }
}
