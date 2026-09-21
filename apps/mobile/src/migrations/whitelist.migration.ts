import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { makeServiceMigration } from './_fns.service';

export const whitelistServiceMigration =
  makeServiceMigration<APP_STORE_NAMES.whitelist>({
    '2026-04-20T00:00:00Z': {
      shouldMigration: ctx => ctx.semverModule.gte(ctx.appVersion, '0.6.66'),
      migrate: ctx => {
        const whitelistService = ctx.service;
        whitelistService.applyWhitelistMigration(
          whitelistService.store.whitelists,
        );
      },
    },
  });
