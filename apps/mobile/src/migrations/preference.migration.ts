import {
  APP_STORE_NAMES,
  GET_SERVICE_BY_NAME,
} from '@/core/storage/storeConstant';
import { makeMigration, makeServiceMigration } from './_fns';

import type { IDefiOrToken, IManageToken } from '@/core/services/preference';
import { urlUtils } from '@rabby-wallet/base-utils';

export const preferenceStoreMigration = makeMigration({
  // '20250101-000000': {
  //   minAppVer: '0.5.6',
  //   migrator: ctx => {
  //     const preferenceData = ctx.appStorage.getItem('preference');
  //     console.debug(`${ctx.loggerPrefix} preferenceData`, preferenceData);
  //     return ctx;
  //   },
  // },
  // '20250108-000000': (ctx) => {
  //   return ctx;
  // },
});

function sortObjByKey<T extends Record<string, any>>(obj: T): T {
  return Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      // @ts-expect-error
      acc[key] = obj[key];
      return acc;
    }, {} as T);
}

function makeManageTokenKey(x: IManageToken) {
  return urlUtils.obj2query(sortObjByKey(x));
}

function decodeManageTokenKey(x: string): IManageToken {
  const { chainId, tokenId } = urlUtils.query2obj(x);
  return { chainId, tokenId };
}

function makeDefiOrTokenKey(x: IDefiOrToken) {
  return urlUtils.obj2query(sortObjByKey(x));
}

function decodeDefiOrTokenKey(x: string): IDefiOrToken {
  const { chainid, id, type } = urlUtils.query2obj(x);
  return { chainid, id, type: type as any };
}

export const preferenceServiceMigration =
  makeServiceMigration<APP_STORE_NAMES.preference>({
    '20250101-000000': {
      minAppVer: '0.5.4',
      migrate: ctx => {
        const preferenceService = ctx.service;
        const srv = ctx.service;
        console.debug(
          `${ctx.loggerPrefix} preferenceService.store.tokenManageSettingMap`,
          preferenceService.store.tokenManageSettingMap,
        );

        const _logMigratedData = () => {
          // // leave here for debug
          // console.debug(
          //   'srv.store.pinedQueue',
          //   JSON.stringify(srv.store.pinedQueue, null, '\t'),
          //   'srv.store.foldTokens',
          //   JSON.stringify(srv.store.foldTokens, null, '\t'),
          //   'srv.store.unfoldTokens',
          //   JSON.stringify(srv.store.unfoldTokens, null, '\t'),
          // );
          // // leave here for debug
          // console.debug(
          //   'srv.store.includeDefiAndTokens',
          //   JSON.stringify(srv.store.includeDefiAndTokens, null, '\t'),
          //   'srv.store.excludeDefiAndTokens',
          //   JSON.stringify(srv.store.excludeDefiAndTokens, null, '\t'),
          // );
        };
        const tokenManageSettingMap = { ...srv.store.tokenManageSettingMap };
        if (Object.keys(tokenManageSettingMap).length === 0) {
          _logMigratedData();
          return;
        }

        // leave here for debug
        // console.debug('[preference::_migrate] srv.store.tokenManageSettingMap', JSON.stringify(srv.store.tokenManageSettingMap, null, '\t'));
        const lists = {
          pinedQueue: srv.store.pinedQueue || [],
          foldTokens: srv.store.foldTokens || [],
          unfoldTokens: srv.store.unfoldTokens || [],
          includeDefiAndTokens: srv.store.includeDefiAndTokens || [],
          excludeDefiAndTokens: srv.store.excludeDefiAndTokens || [],
        };
        const sets = {
          pinedQueue: new Set(lists.pinedQueue.map(x => makeManageTokenKey(x))),
          foldTokens: new Set(lists.foldTokens.map(x => makeManageTokenKey(x))),
          unfoldTokens: new Set(
            lists.unfoldTokens.map(x => makeManageTokenKey(x)),
          ),
          includeDefiAndTokens: new Set(
            lists.includeDefiAndTokens.map(x => makeDefiOrTokenKey(x)),
          ),
          excludeDefiAndTokens: new Set(
            lists.excludeDefiAndTokens.map(x => makeDefiOrTokenKey(x)),
          ),
        };

        Object.entries(tokenManageSettingMap).forEach(
          ([eoaAddress, setting]) => {
            (['pinedQueue', 'foldTokens', 'unfoldTokens'] as const).forEach(
              key => {
                setting[key]?.forEach(item => {
                  const k = makeManageTokenKey(item);
                  if (!sets[key].has(k)) sets[key].add(k);
                });

                ctx._trimLegacyData(() => {
                  setting[key] = [];
                });
              },
            );

            (['includeDefiAndTokens', 'excludeDefiAndTokens'] as const).forEach(
              key => {
                setting[key]?.forEach(item => {
                  const k = makeDefiOrTokenKey(item);
                  if (!sets[key].has(k)) sets[key].add(k);
                });

                ctx._trimLegacyData(() => {
                  setting[key] = [];
                });
              },
            );

            ctx._trimLegacyData(() => {
              delete tokenManageSettingMap[eoaAddress];
            });
          },
        );

        priority_process: {
          // pinedQueue > foldTokens > unfoldTokens
          sets.pinedQueue.forEach(k => {
            sets.foldTokens.delete(k);
            sets.unfoldTokens.delete(k);
          });
          sets.foldTokens.forEach(k => {
            sets.unfoldTokens.delete(k);
          });

          lists.pinedQueue = [...sets.pinedQueue].map(k =>
            decodeManageTokenKey(k),
          );
          lists.foldTokens = [...sets.foldTokens].map(k =>
            decodeManageTokenKey(k),
          );
          lists.unfoldTokens = [...sets.unfoldTokens].map(k =>
            decodeManageTokenKey(k),
          );

          // excludeDefiAndTokens > includeDefiAndTokens
          sets.excludeDefiAndTokens.forEach(k => {
            sets.includeDefiAndTokens.delete(k);
          });

          lists.excludeDefiAndTokens = [...sets.excludeDefiAndTokens].map(k =>
            decodeDefiOrTokenKey(k),
          );
          lists.includeDefiAndTokens = [...sets.includeDefiAndTokens].map(k =>
            decodeDefiOrTokenKey(k),
          );
        }

        flush_back: {
          srv.store.pinedQueue = lists.pinedQueue;
          srv.store.foldTokens = lists.foldTokens;
          srv.store.unfoldTokens = lists.unfoldTokens;

          srv.store.includeDefiAndTokens = lists.includeDefiAndTokens;
          srv.store.excludeDefiAndTokens = lists.excludeDefiAndTokens;

          _logMigratedData();

          srv.store.tokenManageSettingMap = tokenManageSettingMap;
        }
      },
    },
  });
