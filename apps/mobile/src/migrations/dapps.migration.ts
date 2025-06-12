import { APP_STORE_NAMES } from '@/core/storage/storeConstant';
import { makeServiceMigration } from './_fns.service';
import { appStorage } from '@/core/storage/mmkv';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';

export const dappServiceMigration = makeServiceMigration<APP_STORE_NAMES.dapps>(
  {
    '2025-04-29T00:00:00Z': {
      shouldMigration: ctx => ctx.semverModule.gte(ctx.appVersion, '0.6.12'),
      migrate: ctx => {
        try {
          // 给所有已连接但没有 currentAccount 的 dapp 设置 currentAccount，优先使用 ActiveDappWebViewModal 的 sceneAccount
          // 如果 ActiveDappWebViewModal 的 sceneAccount 不存在，则使用 preference 的 currentAccount
          const dappService = ctx.service;
          const sceneAccounts = appStorage.getItem(
            '@SceneAccounts',
          ) as unknown as string;
          let dappSceneAccount: KeyringAccount | null = null;
          try {
            const sceneAccountsObj = JSON.parse(sceneAccounts);
            dappSceneAccount =
              sceneAccountsObj['@ActiveDappWebViewModal']?.currentAccount;
          } catch (error) {
            console.error(error);
          }
          const preference = ctx.services[APP_STORE_NAMES.preference];

          const currentAccount = preference.getFallbackAccount();
          const dapps = Object.values(dappService.getDapps());
          dapps
            .filter(dapp => dapp.isConnected && !dapp.currentAccount)
            .forEach(dapp => {
              dappService.updateDapp({
                ...dapp,
                currentAccount: dappSceneAccount || currentAccount,
              });
            });
        } catch (e) {
          // DO NOTHING
        }
      },
    },
  },
);
