import 'reflect-metadata';
import { Entity, LessThan, MoreThan, UpdateDateColumn } from 'typeorm/browser';
import { KeyringEventAccount } from '@rabby-wallet/service-keyring';

import { EntityAccountBase } from './base';
import { prepareAppDataSource } from '../imports';
import { resolveDriverAndConnectionFromEntity } from '@/core/databases/op-sqlite/typeorm';
import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';
import { ormEvents } from './_helpers';

@Entity(ORM_TABLE_NAMES.account_info)
export class AccountInfoEntity extends EntityAccountBase {
  @UpdateDateColumn({ type: 'integer', nullable: true }) updated_at?: number =
    Date.now();

  static fillEntity(e: AccountInfoEntity, account: KeyringEventAccount) {
    e.address = account.address.toLocaleLowerCase();
    e.type = account.type;
    e.brandName = account.brandName;

    return e.makeDbId();
  }

  static async recordNewAccount(
    account: KeyringEventAccount | KeyringEventAccount[],
  ) {
    const ds = await prepareAppDataSource();
    const { connection } = resolveDriverAndConnectionFromEntity(
      ds,
      AccountInfoEntity,
    );

    const accounts = Array.isArray(account) ? account : [account];

    const stmSql = `
INSERT INTO "${APP_DB_PREFIX}${ORM_TABLE_NAMES.account_info}"
("_db_id", "created_at", "updated_at", "address", "type", "brandName")
VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT ( "_db_id" ) DO UPDATE SET "updated_at" = EXCLUDED."updated_at"
    `;

    const db = connection.getDb();
    const stm = db.prepareStatement(stmSql);

    let entity = new AccountInfoEntity();
    const insertedIds: any[] = [];
    for (let account of accounts) {
      AccountInfoEntity.fillEntity(entity, account);
      stm.bindSync([
        /* _db_id */ entity._db_id,
        /* created_at */ Date.now(),
        /* updated_at */ Date.now(),
        /* address */ entity.address,
        /* type */ entity.type,
        /* brandName */ entity.brandName,
      ]);

      const result = await stm.execute();
      insertedIds.push(result);
    }

    return insertedIds;
  }

  static async deleteByAccount(account: KeyringEventAccount) {
    const ds = await prepareAppDataSource();
    const repo = ds.getRepository(AccountInfoEntity);
    const entity = new AccountInfoEntity();
    AccountInfoEntity.fillEntity(entity, account);

    const deleteResult = await repo.delete({ _db_id: entity._db_id });

    ormEvents.emit(`account_info:removed`, { deleteResult });
  }

  static async trimExpiredAccounts(duration = 60 * 1e3 * 10) {
    const ds = await prepareAppDataSource();
    const repo = ds.getRepository(AccountInfoEntity);
    const nowInt = Date.now();
    const expireDivider = nowInt - duration;

    if (expireDivider <= 0) {
      console.warn(
        '[warn] trimExpiredAccounts called with non-positive duration',
      );
      return;
    }

    const deleteResult = await repo.delete({
      updated_at: LessThan(expireDivider),
    });
  }

  static async getAccountsAddedIn(
    time = 60 * 1e3 * 10,
    options?: { trimExpired?: boolean },
  ) {
    await prepareAppDataSource();

    const queryBuilder = this.getRepository().createQueryBuilder(
      ORM_TABLE_NAMES.account_info,
    );
    const nowInt = Date.now();

    queryBuilder
      .where({
        updated_at: MoreThan(nowInt - time),
      })
      .andWhere({
        updated_at: LessThan(nowInt),
      });

    queryBuilder.orderBy(`${ORM_TABLE_NAMES.account_info}.updated_at`, 'DESC');

    const newlyAddedAccounts = await queryBuilder.getMany();

    return newlyAddedAccounts.map(acc => ({
      _db_id: acc._db_id,
      address: acc.address,
      type: acc.type,
      brandName: acc.brandName,
      created_at: acc.created_at,
      updated_at: acc.updated_at || 0,
    }));
  }

  static async isAccountAddedIn(time = 60 * 1e3 * 10) {
    await prepareAppDataSource();

    const queryBuilder = this.getRepository().createQueryBuilder(
      ORM_TABLE_NAMES.account_info,
    );
    const nowInt = Date.now();

    queryBuilder
      .where({
        updated_at: MoreThan(nowInt - time),
      })
      .andWhere({
        updated_at: LessThan(nowInt),
      });

    queryBuilder.orderBy(`${ORM_TABLE_NAMES.account_info}.updated_at`, 'DESC');

    const foundOne = await queryBuilder.getRawOne();

    return !!foundOne;
  }
}
