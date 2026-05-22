import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { Button } from '@/components2024/Button';
import { RootNames } from '@/constant/layout';
import { transactionHistoryService } from '@/core/services';
import { Account } from '@/core/services/preference';
import { useMyAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import type { HistoryDisplayItem } from '@/types/history';
import { findAccountByPriority } from '@/utils/account';
import { findChain, findChainByServerID } from '@/utils/chain';
import { naviPush } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS_ENUM } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils/src/types';
import { StackActions } from '@react-navigation/native';
import { useRequest } from 'ahooks';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { HistoryItemCateType } from './type';

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
    ]) as ViewStyle;
    return {
      btnContainerViewStyle: viewStyle,
      buttonStyle: { height: viewStyle.height || 56 },
    };
  }, [styles.buttonContainer, buttonContainerStyle]);

  const source = useMemo(
    () => transactionTxs?.$ctx?.ga?.source ?? '',
    [transactionTxs],
  );

  const PlaceHolder = <View style={styles.placeholder} />;

  if (!fromAddrIsImported) {
    return PlaceHolder;
  }

  switch (type) {
    case HistoryItemCateType.Send: {
      const isLocalSend = source === 'sendNFT' || source === 'sendToken';
      if (!isLocalSend) {
        return PlaceHolder;
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
      return PlaceHolder;
    case HistoryItemCateType.Swap:
      const isLocalSwap =
        source === 'approvalAndSwap|swap' || source === 'swap';
      if (!isLocalSwap) {
        return <View style={styles.placeholder} />;
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
      return PlaceHolder;
  }
};

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    tokenAmountText: {
      color: colors2024['green-default'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
    },
    buttonContainer: {
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: Math.max(safeAreaInsets.bottom, 36),
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
      position: 'relative',
      flexShrink: 0,
      width: '100%',
      gap: 16,
    },
    placeholder: {
      minHeight: Math.max(safeAreaInsets.bottom, 24),
      flexShrink: 0,
    },
  }),
);
