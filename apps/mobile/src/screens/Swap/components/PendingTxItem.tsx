import { AssetAvatar } from '@/components';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { RootNames } from '@/constant/layout';
import {
  SwapTxHistoryItem,
  SendTxHistoryItem,
  ApproveTokenTxHistoryItem,
} from '@/core/services/transactionHistory';
import {
  bridgeService,
  swapService,
  transactionHistoryService,
} from '@/core/services';
import { SendRequireData } from '@rabby-wallet/rabby-action/dist/types/actionRequireData';
import { getAliasName } from '@/core/apis/contact';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useTheme2024 } from '@/hooks/theme';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { ellipsisAddress } from '@/utils/address';
import { findChain } from '@/utils/chain';
import { naviPush } from '@/utils/navigation';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import BigNumber from 'bignumber.js';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { sendToken } from '@/core/apis/token';
import { useMemoizedFn } from 'ahooks';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import { noop } from 'lodash';
import useAsync from 'react-use/lib/useAsync';
import useMount from 'react-use/lib/useMount';
export const PendingTxItem = ({
  data,
  clearLocalPendingTxData,
  isForMultipleAddress,
  type,
}: {
  data: SwapTxHistoryItem | SendTxHistoryItem | ApproveTokenTxHistoryItem;
  clearLocalPendingTxData: () => void;
  isForMultipleAddress: boolean;
  type: 'send' | 'swap' | 'approveSwap';
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const chainItem = React.useMemo(
    () =>
      findChain({
        id: data?.chainId,
      }),
    [data?.chainId],
  );
  const isPending = data.status === 'pending';
  const chainName = chainItem?.name || '';
  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const handlePress = useMemoizedFn(() => {
    if (type === 'approveSwap') {
      return;
    }
    if (!isPending) {
      clearLocalPendingTxData();
      type === 'send' &&
        swapService.setOpenSwapHistoryTs(currentAccount?.address ?? '');
    }

    const { pendings, completeds } = transactionHistoryService.getList(
      currentAccount?.address ?? '',
    );
    const naviData = isPending ? pendings : completeds;
    const groupData = naviData.find(
      item =>
        item.chainId === data.chainId &&
        item.txs.find(tx => tx.hash === data.hash),
    );
    if (!groupData) {
      return;
    }
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.HistoryLocalDetail,
      params: {
        isForMultipleAddress,
        data: groupData,
        type:
          type === 'send' ? HistoryItemCateType.Send : HistoryItemCateType.Swap,
        title:
          type === 'send'
            ? t('page.transactions.itemTitle.Send')
            : t('page.transactions.itemTitle.Swap'),
      },
    });
  });

  // const sendActionData = data.maxGasTx.action?.actionData?.send;
  // const payToken = data?.fromToken;
  // const receiveToken = data?.toToken;
  // const sendTokenList = data.maxGasTx.explain?.balance_change?.send_token_list;
  // const receiveTokenList =
  //   data.maxGasTx.explain?.balance_change?.receive_token_list;

  const sendTitleTextStr = useMemo(() => {
    if (type === 'send') {
      const sendData = data as SendTxHistoryItem;
      const sendAmount = formatTokenAmount(sendData?.amount);
      return `-${sendAmount} ${getTokenSymbol(sendData?.token)}`;
    }
    if (type.startsWith('approve')) {
      const approveData = data as ApproveTokenTxHistoryItem;
      const amount = approveData.amount;
      return `Approval ${amount} ${getTokenSymbol(approveData.token)}`;
    }
    return '';
  }, [type, data]);

  const isFailed = useMemo(() => {
    return data.status === 'failed';
  }, [data]);

  return (
    <>
      <View style={styles.header}>
        <View style={styles.dottedLine} />
        <View style={styles.dot} />
        <View style={styles.dottedLine} />
      </View>
      <TouchableOpacity style={styles.container} onPress={handlePress}>
        <View style={styles.leftContainer}>
          <View style={styles.mainContainer}>
            <View style={styles.titleContainer}>
              {type === 'approveSwap' ? (
                <>
                  <AssetAvatar
                    logo={(data as ApproveTokenTxHistoryItem)?.token?.logo_url}
                    chain={chainItem?.serverId}
                    chainSize={14}
                    size={25}
                    innerChainStyle={styles.innerChainStyle}
                  />
                  <Text style={styles.titleText}>{sendTitleTextStr}</Text>
                </>
              ) : type === 'send' ? (
                <>
                  <AssetAvatar
                    logo={(data as SendTxHistoryItem)?.token?.logo_url}
                    chain={chainItem?.serverId}
                    chainSize={14}
                    size={25}
                    innerChainStyle={styles.innerChainStyle}
                  />
                  <Text style={styles.titleText}>{sendTitleTextStr}</Text>
                </>
              ) : (
                <>
                  <AssetAvatar
                    logo={(data as SwapTxHistoryItem)?.fromToken?.logo_url}
                    chain={(data as SwapTxHistoryItem)?.fromToken?.chain}
                    chainSize={14}
                    size={25}
                    innerChainStyle={styles.innerChainStyle}
                  />
                  <Text style={styles.titleText}>
                    {` ${getTokenSymbol(
                      (data as SwapTxHistoryItem)?.fromToken,
                    )}`}
                  </Text>
                  <Text style={styles.titleText}>{'→'}</Text>
                  <AssetAvatar
                    logo={(data as SwapTxHistoryItem)?.toToken?.logo_url}
                    chain={(data as SwapTxHistoryItem)?.toToken?.chain}
                    chainSize={14}
                    size={25}
                    innerChainStyle={styles.innerChainStyle}
                  />
                  <Text style={styles.titleText}>
                    {getTokenSymbol((data as SwapTxHistoryItem)?.toToken)}
                  </Text>
                </>
              )}
            </View>
            {/* {SubTitleContainer} */}
          </View>
        </View>

        <View style={styles.rightContainer}>
          {isPending ? (
            <View style={styles.statusContainer}>
              <TxStatusItem status={1} isPending={true} />
              <Text style={styles.statusText}>
                {t('page.transactions.detail.Pending')}
              </Text>
            </View>
          ) : (
            <View style={styles.statusContainer}>
              <TxStatusItem status={isFailed ? 0 : 1} showSuccess={true} />
              <Text style={styles.statusText}>
                {isFailed
                  ? t('page.transactions.detail.Failed')
                  : t('page.transactions.detail.Succeeded')}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </>
  );
};

export const ApprovePendingTxItem = ({
  type,
  address,
  isForMultipleAddress,
  hash,
  chainId,
}: // hash,
{
  type: 'approveSwap';
  isForMultipleAddress: boolean;
  address: string;
  chainId: number;
  hash: string;
}) => {
  const [{ value: data }, getApproveItem] = useAsyncFn(async () => {
    const v = await transactionHistoryService.getRecentTxHistory(
      address,
      hash,
      chainId,
      type,
    );
    return v as ApproveTokenTxHistoryItem;
  }, [type, address]);

  useMount(() => {
    getApproveItem();
  });

  useEffect(() => {
    if (!data || (data.hash === hash && data.status === 'pending')) {
      let timer = setTimeout(() => getApproveItem(), 1000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [getApproveItem, data?.status, data, hash]);

  if (!data || data.hash !== hash) {
    return null;
  }
  if (!data || data.hash !== hash) {
    return null;
  }

  return (
    <PendingTxItem
      type={type}
      data={data}
      clearLocalPendingTxData={noop}
      isForMultipleAddress={isForMultipleAddress}
    />
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  IconContainer: {
    position: 'relative',
    width: 26,
    height: 26,
  },
  innerChainStyle: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors2024['neutral-bg-1'],
  },
  leftIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 30,
  },
  rightIcon: {
    borderWidth: 2,
    borderColor: colors2024['neutral-bg-1'],
    position: 'absolute',
    right: -2,
    bottom: -3,
    borderRadius: 40,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  arrow: {
    position: 'absolute',
    top: 2,
    right: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 18,
    justifyContent: 'center',
  },
  dottedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderColor: colors2024['neutral-line'],
    opacity: 0.5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 16,
    backgroundColor: colors2024['neutral-info'],
  },
  mainContainer: {
    gap: 2,
  },
  arrowIcon: {
    width: 16,
    height: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subTitleText: {
    color: colors2024['neutral-secondary'],
    lineHeight: 16,
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    fontWeight: '500',
    alignItems: 'center',
  },
  subTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  titleText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  leftContainer: {
    gap: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 2,
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
}));
