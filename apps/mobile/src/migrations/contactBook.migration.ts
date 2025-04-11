import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { makeServiceMigration } from './_fns.service';
import { ellipsis } from '@/utils/address';

export const contactBookServiceMigration =
  makeServiceMigration<APP_STORE_NAMES.contactBook>({
    '2025-04-09T00:00:00Z': {
      shouldMigration: ctx => ctx.semverModule.gte(ctx.appVersion, '0.6.8'),
      migrate: ctx => {
        const contactBookService = ctx.service;
        console.debug(
          `${ctx.loggerPrefix} contactBookService.store`,
          contactBookService.store,
        );
        const list = contactBookService.listAlias();
        list.forEach(item => {
          const str1 = ellipsis(item.address, 4).toLowerCase();
          if (str1 === item.alias.toLowerCase()) {
            contactBookService.updateAlias({
              address: item.address,
              name: ellipsis(item.address),
            });
          }
        });
      },
    },
  });
