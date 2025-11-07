import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tip } from '@/components';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { useTranslation } from 'react-i18next';
import { RootNames } from '@/constant/layout';
import { Button } from '@/components2024/Button';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { findChain, findChainByServerID } from '@/utils/chain';
import { CHAINS_ENUM } from '@debank/common';
import { approveToken, revokeNFTApprove } from '@/core/apis/approvals';
import { resetNavigationTo } from '@/hooks/navigation';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { fetchHistoryTokenUUId } from './utils';
import { useMyAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { HistoryItemCateType } from './type';
import { useSendRoutes } from '@/hooks/useSendRoutes';
import { useRequest } from 'ahooks';
import { transactionHistoryService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { findAccountByPriority } from '@/utils/account';
import { naviPush } from '@/utils/navigation';

interface ItemProps {
  status: number;
  className?: string;
  type: HistoryItemCateType;
  chain: string;
  receives: HistoryDisplayItem['receives'];
  sends: HistoryDisplayItem['sends'];
  approve: HistoryDisplayItem['token_approve'];
  data: HistoryDisplayItem;
  isForMultipleAddress?: boolean;
  buttonContainerStyle?: RNViewProps['style'];
  account: Account;
}

export const HistoryBottomBtn = ({
  status,
  type,
  sends,
  data,
  approve,
  chain,
  receives,
  isForMultipleAddress = true,
  buttonContainerStyle,
  account: currentAccount,
}: ItemProps) => {
  const { t } = useTranslation();
  const { navigation } = useSafeSetNavigationOptions();
  const { styles } = useTheme2024({ getStyle });
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();
  const { accounts } = useMyAccounts();

  const { data: transactionTxs } = useRequest(async () => {
    const { completeds } = transactionHistoryService.getList(
      data.tx?.from_addr || '',
    );

    const item = completeds.find(
      i =>
        findChain({
          id: i.chainId,
        })?.serverId === data.chain && i.maxGasTx.hash === data.id,
    );
    return item;
  });

  const fromAddrIsImported = useMemo(() => {
    const canUseAccountList = accounts.filter(acc => {
      return (
        addressUtils.isSameAddress(acc.address, data.tx?.from_addr || '') &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    const fromAccount = findAccountByPriority(canUseAccountList);

    return fromAccount;
  }, [accounts, data]);

  const { btnContainerViewStyle, buttonStyle } = useMemo(() => {
    const viewStyle = StyleSheet.flatten([
      styles.buttonContainer,
      buttonContainerStyle,
    ]);
    return {
      btnContainerViewStyle: viewStyle,
      buttonStyle: { height: viewStyle.height || 56 },
    };
  }, [styles.buttonContainer, buttonContainerStyle]);

  const source = useMemo(
    () => transactionTxs?.$ctx?.ga?.source ?? '',
    [transactionTxs],
  );

  if (!fromAddrIsImported) {
    return null;
  }

  switch (type) {
    case HistoryItemCateType.Send: {
      const isLocalSend = source === 'sendNFT' || source === 'sendToken';
      if (!isLocalSend) {
        return null;
      }

      const isNft = sends[0]?.token_id?.length === 32;
      return isNft ? null : (
        <View style={btnContainerViewStyle}>
          <Button
            buttonStyle={buttonStyle}
            onPress={async () => {
              const sendToken = sends[0]?.token;
              const chainItem = findChain({
                serverId: sendToken.chain,
              });
              await switchSceneCurrentAccount(
                'MakeTransactionAbout',
                isForMultipleAddress ? fromAddrIsImported : currentAccount,
              );
              naviPush(RootNames.StackTransaction, {
                screen: RootNames.Send,
                params: {
                  chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                  tokenId: sends[0]?.token_id,
                  toAddress: sends[0]?.to_addr,
                },
              });
            }}
            title={t('page.transactions.detail.SendAgain')}
          />
        </View>
      );
    }
    case HistoryItemCateType.Recieve:
      return null;
    case HistoryItemCateType.Swap:
      const isLocalSwap =
        source === 'approvalAndSwap|swap' || source === 'swap';
      if (!isLocalSwap) {
        return null;
      }

      return (
        <View style={btnContainerViewStyle}>
          <Button
            buttonStyle={buttonStyle}
            onPress={async () => {
              const chainItem = !chain ? null : findChainByServerID(chain);
              // if (!isForMultipleAddress) {
              await switchSceneCurrentAccount(
                'MakeTransactionAbout',
                isForMultipleAddress ? fromAddrIsImported : currentAccount,
              );
              // }
              navigation.dispatch(
                StackActions.push(RootNames.StackTransaction, {
                  screen: isForMultipleAddress
                    ? RootNames.MultiSwap
                    : RootNames.Swap,
                  params: {
                    swapAgain: true,
                    chainEnum: chainItem?.enum ?? CHAINS_ENUM.ETH,
                    swapTokenId: [sends[0]?.token_id, receives[0]?.token_id],
                  },
                }),
              );
            }}
            title={t('page.transactions.detail.SwapAgain')}
          />
        </View>
      );
    case HistoryItemCateType.Contract:
    case HistoryItemCateType.Cancel:
    case HistoryItemCateType.Bridge:
    case HistoryItemCateType.UnKnown:
    default:
      return null;
  }
  // return <RcIconDefault style={[styles.image, style]} />;
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  ghostDisableButton: {
    color: colors2024['neutral-info'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  buttonContainer: {
    // ...makeDebugBorder(),
    position: 'relative',
    flexShrink: 0,
    height: 56,
    marginBottom: 0,
    width: '100%',
    gap: 16,
  },
}));
