import { TransactionNavigatorParamList } from '@/navigation-type';
import { NavigatorScreenParams } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { useCallback } from 'react';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { matomoRequestEvent } from '@/utils/analytics';
import { naviPush } from '@/utils/navigation';
import { whitelistServiceApi } from '@/core/serviceApi/whitelist';
import { storeApiAccounts } from '@/hooks/account';
import type { KeyringAccountWithAlias } from '@/types/account';
import { filterMyAccounts, findAccountByPriority } from '@/utils/account';
import { getContactAliasSnapshot } from '@/core/serviceApi/contact';
import { ellipsisAddress } from '@/utils/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
type SendRouteParams = NonNullable<
  TransactionNavigatorParamList[typeof RootNames.Send]
>;
type SendNFTRouteParams =
  TransactionNavigatorParamList[typeof RootNames.SendNFT];
type SendRouteIntent = SendRouteParams | SendNFTRouteParams;

async function getWhitelistRecordsForSendRoute() {
  try {
    return await whitelistServiceApi.getWhitelistRecords();
  } catch {
    return [];
  }
}

async function findAccountWithoutBalanceForSendRoute(address: string): Promise<{
  inWhitelist: boolean;
  isMyImported: boolean;
  account: KeyringAccountWithAlias;
}> {
  const whitelist = await getWhitelistRecordsForSendRoute();
  const accounts = storeApiAccounts.getAccounts();
  const targetAccounts = accounts.filter(item =>
    isSameAddress(item.address, address),
  );
  const myAccountsInner = filterMyAccounts(accounts);
  const defaultAccount: KeyringAccountWithAlias = {
    address,
    aliasName:
      getContactAliasSnapshot(address)?.alias || ellipsisAddress(address),
    balance: 0,
    type: KEYRING_CLASS.WATCH,
    brandName: KEYRING_CLASS.WATCH,
  };

  return {
    inWhitelist: whitelist.some(item => isSameAddress(item.address, address)),
    isMyImported: myAccountsInner.some(item =>
      isSameAddress(item.address, address),
    ),
    account: targetAccounts.length
      ? findAccountByPriority(targetAccounts)
      : defaultAccount,
  };
}

export const useSendRoutes = () => {
  const hasNftParams = useCallback(
    (params: SendRouteIntent): params is SendNFTRouteParams => {
      return 'nftItem' in params;
    },
    [],
  );

  const getTargetScreen = useCallback(
    (params: SendRouteIntent, isForSingleAddress: boolean) => {
      const hasNft = hasNftParams(params);
      if (hasNft) {
        return RootNames.SendNFT;
      } else {
        return isForSingleAddress ? RootNames.Send : RootNames.MultiSend;
      }
    },
    [hasNftParams],
  );

  /** @deprecated */
  const navigateToTargetScreen = useCallback(
    (params: SendRouteIntent, isForSingleAddress: boolean) => {
      const targetScreen = getTargetScreen(params, isForSingleAddress);

      naviPush(RootNames.StackTransaction, {
        screen: targetScreen,
        params,
      } as NavigatorScreenParams<TransactionNavigatorParamList>);
    },
    [getTargetScreen],
  );

  const navigateToSendScreen = useCallback(
    (params: SendRouteIntent = {}, isForSingleAddress = true) => {
      navigateToTargetScreen(params, isForSingleAddress);
    },
    [navigateToTargetScreen],
  );

  /** @deprecated */
  const navigateToSendPolyScreen = useCallback(
    async (isForSingleAddress: boolean, params: SendRouteIntent = {}) => {
      matomoRequestEvent({
        category: 'Send Usage',
        action: 'Send_Enter',
      });

      if (params.toAddress) {
        const { inWhitelist, account, isMyImported } =
          await findAccountWithoutBalanceForSendRoute(params.toAddress);
        if (inWhitelist || isMyImported) {
          navigateToTargetScreen(params, isForSingleAddress);
        } else {
          const id = createGlobalBottomSheetModal2024({
            name: MODAL_NAMES.CONFIRM_ADDRESS,
            account,
            bottomSheetModalProps: {
              enableDynamicSizing: true,
            },
            onCancel: () => {
              removeGlobalBottomSheetModal2024(id);
            },
            onConfirm: (acc, addressDesc) => {
              removeGlobalBottomSheetModal2024(id);
              navigateToSendScreen(
                {
                  ...params,
                  addressBrandName: acc.brandName,
                  addrDesc: addressDesc,
                  toAddress: acc.address,
                },
                isForSingleAddress,
              );
            },
          });
        }
        return;
      }

      navigateToTargetScreen(params, isForSingleAddress);
    },
    [navigateToSendScreen, navigateToTargetScreen],
  );

  return {
    /** @deprecated */
    navigateToSendPolyScreen,
    navigateToSendScreen,
  };
};
