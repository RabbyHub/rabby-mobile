import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { makeStoreMigration } from './_fns.store';
import { makeServiceMigration } from './_fns.service';

import type { IDefiOrToken, IManageToken } from '@/core/services/preference';
import { urlUtils } from '@rabby-wallet/base-utils';

export const preferenceStoreMigration = makeStoreMigration({
  '2025-01-01T00:00:00Z': {
    shouldMigration: !__DEV__
      ? false
      : ctx => ctx.semverModule.gte(ctx.appVersion, '0.5.4'),
    migrator: ctx => {
      const preferenceData = ctx.appStorage.getItem(APP_STORE_NAMES.preference);
      console.debug(`${ctx.loggerPrefix} preferenceData`, preferenceData);
    },
  },
  // '2025-01-08T00:00:00Z': (ctx) => {
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
    '2024-12-25T00:00:00Z': ctx => {
      return ctx;
    },
    '2025-01-01T00:00:00Z': {
      shouldMigration: ctx => ctx.semverModule.gte(ctx.appVersion, '0.5.4'),
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
    '2025-12-09T00:01:00Z': {
      shouldMigration: ctx => ctx.semverModule.gte(ctx.appVersion, '0.6.48'),
      migrate: ctx => {
        try {
          const srv = ctx.service;
          const pinedQueue = srv.store.pinedQueue || [];
          const unfoldTokens = srv.store.unfoldTokens || [];

          if (!pinedQueue.length || !unfoldTokens.length) {
            return;
          }

          const pinedSet = new Set(
            pinedQueue.map(token => makeManageTokenKey(token)),
          );
          const filteredUnfoldTokens = unfoldTokens.filter(
            token => !pinedSet.has(makeManageTokenKey(token)),
          );
          if (filteredUnfoldTokens.length === unfoldTokens.length) {
            return;
          }

          srv.store.unfoldTokens = filteredUnfoldTokens;

          console.debug(
            `${ctx.loggerPrefix} filtered unfoldTokens from pinedQueue`,
            srv.store.unfoldTokens,
          );
        } catch (e) {
          // DO NOTHING
        }
      },
    },
  });
