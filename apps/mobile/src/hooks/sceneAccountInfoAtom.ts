import { MMKVStorageStrategy, zustandByMMKV } from '@/core/storage/mmkv';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { KeyringAccount } from '@rabby-wallet/keyring-utils';
import { cloneDeep } from 'lodash';

export type SceneAccountInfo = {
  currentAccount: KeyringAccount | null;
  /**
   * @description account used to sign for current scene
   */
  signingAccount: KeyringAccount | null;
  /**
   * @description use all accounts in this scene, not only one "current" account
   *
   * in some scenes it means fetch all data from all accounts, such as transaction history
   */
  useAllAccounts?: boolean;
};

export type AccountSwitcherScene = keyof typeof AccountSwitcherInfos;

export type SceneAccounts = {
  [K in AccountSwitcherScene]?: SceneAccountInfo;
};

export function makeSceneAccount(): SceneAccountInfo {
  return {
    currentAccount: null,
    signingAccount: null,
    useAllAccounts: false,
  };
}
export const AccountSwitcherInfos = {
  MakeTransactionAbout: makeSceneAccount(),
  // Send: makeSceneAccount(),
  SendNFT: makeSceneAccount(),
  // Swap: makeSceneAccount(),
  // Bridge: makeSceneAccount(),

  History: makeSceneAccount(),
  MultiHistory: makeSceneAccount(),

  Receive: makeSceneAccount(),
  GasAccount: makeSceneAccount(),
  Lending: makeSceneAccount(),
  TokenDetail: makeSceneAccount(),
  Approvals: makeSceneAccount(),

  '@ActiveDappWebViewModal': makeSceneAccount(),
};
// TODO: maybe we should trim all siginingAccount on bootstrap?
// export const sceneAccountInfoAtom = atomByMMKV<SceneAccounts>(
//   '@SceneAccounts',
//   AccountSwitcherInfos,
//   { storage: MMKVStorageStrategy.compatJson },
// );

// test migrate data
// runIIFEFunc(() => {
//   if (__DEV__) {
//     appJsonStore.removeItem('@SceneAccounts202512');
//     appJsonStore.setItem('@SceneAccounts', {
//       ...AccountSwitcherInfos,
//       MakeTransactionAbout: {
//         ...AccountSwitcherInfos.MakeTransactionAbout,
//         currentAccount: preferenceService.getFallbackAccount(),
//       },
//       Lending: {
//         ...AccountSwitcherInfos.Lending,
//         currentAccount: {
//           address: '0x9378867a1dff6e18e9a0e20b84a38d163996533f',
//           brandName: 'Ledger Hardware',
//           type: 'Ledger Hardware',
//         },
//         useAllAccounts: false,
//       },
//     });
//   }
// });

export const sceneAccountInfoStore = zustandByMMKV(
  '@SceneAccounts202512',
  AccountSwitcherInfos,
  {
    legacyAppStoreKey: '@SceneAccounts',
    storage: MMKVStorageStrategy.compatJson,
  },
);

export function zSetSceneAccountInfo(
  valOrFunc: UpdaterOrPartials<SceneAccounts>,
) {
  sceneAccountInfoStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });

    return newVal;
  });
}

export function zResetSceneAccountInfo() {
  zSetSceneAccountInfo(cloneDeep(AccountSwitcherInfos));
}
