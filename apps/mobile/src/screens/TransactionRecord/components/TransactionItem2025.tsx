/* eslint-disable react-native/no-inline-styles */
import { TransactionGroup } from '@/core/services/transactionHistory';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  ApproveAction,
  ApproveNFTAction,
  GasLevel,
  ProjectItem,
  SendAction,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TxChange } from '@/screens/Transaction/components/TokenChange';
import {
  ApproveTokenRequireData,
  ParsedTransactionActionData,
  ReceiveTokenItem,
  SendRequireData,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import TokenLabel from '@/screens/Transaction/components/TokenLabel';
import { getTokenSymbol } from '@/utils/token';
import { ellipsisOverflowedText } from '@/utils/text';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { getAliasName } from '@/core/apis/contact';
import { findChain } from '@/utils/chain';
import { transactionHistoryService } from '@/core/services';
import {
  CUSTOM_HISTORY_TITLE_TYPE,
  HistoryItemCateType,
} from '@/screens/Transaction/components/type';
import { TokenChangeDataItem } from '@/screens/Transaction/components/HistoryItem';
import { HistoryItemTokenArea } from '@/screens/Transaction/components/HistoryItemTokenArea';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { ellipsisAddress } from '@/utils/address';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';
import { naviPush } from '@/utils/navigation';
import FastImage from 'react-native-fast-image';
import { GetNestedScreenRouteProp } from '@/navigation-type';

export type HistoryLocalDetailParams = GetNestedScreenRouteProp<
  'TransactionNavigatorParamList',
  'HistoryLocalDetail'
>['params'];

export const TransactionItem = ({
  historySuccessList,
  data,
  canCancel,
  onRefresh,
  isForMultipleAddress,
  isInSendHistory,
  onPressItem,
  onPressAddToWhitelistButton,
  closeHistoryPopup,
  getCexInfoByAddress,
}: {
  historySuccessList?: string[];
  isForMultipleAddress?: boolean;
  getCexInfoByAddress?: (address: string) => ProjectItem;
  data: TransactionGroup;
  canCancel?: boolean;
  onRefresh?: () => void;
  isInSendHistory?: boolean;
  onPressItem?: (ctx: HistoryLocalDetailParams) => void;
  onPressAddToWhitelistButton?: (data: SendAction) => void;
  closeHistoryPopup?: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isCanceled =
    data.isCompleted &&
    isSameAddress(data?.maxGasTx?.rawTx?.from, data?.maxGasTx?.rawTx?.to);
  const [showSuccess, setShowSuccess] = useState(false);
  const isShowSuccess = useMemo(
    () =>
      historySuccessList?.includes(
        `${data.maxGasTx.address}-${data.maxGasTx.hash}` || '',
      ) || showSuccess,
    [data.maxGasTx, historySuccessList, showSuccess],
  );

  const formatType: HistoryItemCateType = useMemo(() => {
    if (data.maxGasTx.action?.actionData.send) {
      if (
        Object.values(L2_DEPOSIT_ADDRESS_MAP).includes(
          data.maxGasTx.action?.actionData.send.to.toLowerCase() || '',
        )
      ) {
        return HistoryItemCateType.GAS_DEPOSIT;
      }

      return HistoryItemCateType.Send;
    }

    if (
      data.maxGasTx.action?.actionData.wrapToken ||
      data.maxGasTx.action?.actionData.unWrapToken
    ) {
      return HistoryItemCateType.Swap;
    }

    if (data.maxGasTx.action?.actionData.swap) {
      if (
        data.maxGasTx.action?.actionData.swap?.payToken?.is_core &&
        data.maxGasTx.action?.actionData.swap?.receiveToken?.is_core
      ) {
        return HistoryItemCateType.Swap;
      }
    }

    if (
      data.maxGasTx.action?.actionData.approveToken ||
      data.maxGasTx.action?.actionData.approveNFT ||
      data.maxGasTx.action?.actionData.approveNFTCollection
    ) {
      return HistoryItemCateType.Approve;
    }

    if (
      data.maxGasTx.action?.actionData.revokeToken ||
      data.maxGasTx.action?.actionData.revokeNFT ||
      data.maxGasTx.action?.actionData.revokeNFTCollection ||
      data.maxGasTx.action?.actionData.revokePermit2
    ) {
      return HistoryItemCateType.Revoke;
    }

    if (data.maxGasTx?.action?.actionData.cancelTx) {
      return HistoryItemCateType.Cancel;
    }

    const balance_change = data.maxGasTx?.explain?.balance_change;
    const balance_change_version =
      data.maxGasTx?.explain?.pre_exec_version || 'v0';
    if (balance_change && balance_change_version !== 'v0') {
      const {
        receive_token_list,
        receive_nft_list,
        send_token_list,
        send_nft_list,
      } = balance_change;
      const noNft =
        receive_nft_list?.length === 0 && send_nft_list?.length === 0;
      const noToken =
        receive_token_list?.length === 0 && send_token_list?.length === 0;
      const noSend =
        send_token_list?.length === 0 && send_nft_list?.length === 0;
      const noReceive =
        receive_token_list?.length === 0 && receive_nft_list?.length === 0;
      if (
        receive_token_list?.length === 1 &&
        send_token_list?.length === 1 &&
        noNft
      ) {
        return HistoryItemCateType.Swap;
      }
      if (
        (receive_token_list?.length === 1 || receive_nft_list?.length === 1) &&
        noSend
      ) {
        return HistoryItemCateType.Recieve;
      }
      if (
        (send_nft_list?.length === 1 || send_token_list?.length === 1) &&
        noReceive
      ) {
        return HistoryItemCateType.Send;
      }
    }

    return HistoryItemCateType.UnKnown;
  }, [data]);

  const { tokenChangeData, tokenApproveData } = useMemo(() => {
    const resToken: TokenChangeDataItem[] = [];
    const resApprove: TokenChangeDataItem[] = [];
    const actionData = data.maxGasTx?.action?.actionData;
    if (!actionData) {
      return {
        tokenChangeData: resToken,
        tokenApproveData: resApprove,
      };
    }

    if (data.maxGasTx.action?.actionData.send) {
      const acData = actionData.send;
      resToken.push({
        token: acData?.token!,
        amount: acData?.token?.amount!,
        type: 'send',
        price: acData?.token?.price,
        token_id: acData?.token?.id!,
      });
    } else if (
      data.maxGasTx.action?.actionData.wrapToken ||
      data.maxGasTx.action?.actionData.unWrapToken ||
      data.maxGasTx.action?.actionData.swap
    ) {
      const swapData = (actionData?.swap ||
        actionData?.unWrapToken ||
        actionData?.wrapToken)!;
      const send = swapData?.payToken!;
      const receive =
        'minReceive' in swapData
          ? swapData.minReceive
          : swapData?.receiveToken!;
      resToken.push({
        token: send!,
        amount: send?.amount!,
        type: 'send',
        token_id: send?.id!,
      });
      resToken.push({
        token: receive!,
        amount: (receive?.amount || (receive as ReceiveTokenItem)?.min_amount)!,
        type: 'receive',
        token_id: receive?.id!,
      });
    } else if (
      data.maxGasTx.action?.actionData.approveToken ||
      data.maxGasTx.action?.actionData.approveNFT ||
      data.maxGasTx.action?.actionData.approveNFTCollection ||
      data.maxGasTx.action?.actionData.revokeToken ||
      data.maxGasTx.action?.actionData.revokeNFT ||
      data.maxGasTx.action?.actionData.revokeNFTCollection ||
      data.maxGasTx.action?.actionData.revokePermit2
    ) {
      const apData =
        actionData?.revokeToken ||
        actionData.approveToken ||
        actionData.approveNFT ||
        actionData?.revokeNFT ||
        // data.txs?.[0]?.action?.actionData.revokeNFTCollection ||
        actionData?.revokePermit2;
      const apToken: TokenItem =
        (apData as ApproveAction)?.token || (apData as ApproveNFTAction)?.nft;
      resApprove.push({
        token: apToken!,
        amount: apToken?.amount!,
        type: 'approve',
        token_id: apToken?.id!,
      });
    } else {
      // default get token change list
      const balance_change = data.maxGasTx?.explain?.balance_change;
      const balance_change_version =
        data.maxGasTx?.explain?.pre_exec_version || 'v0';
      if (balance_change && balance_change_version !== 'v0') {
        const {
          receive_token_list,
          receive_nft_list,
          send_token_list,
          send_nft_list,
        } = balance_change;
        const reciceves = [...receive_token_list, ...receive_nft_list];
        const sends = [...send_token_list, ...send_nft_list];
        reciceves?.forEach(item => {
          resToken.push({
            token: item as TokenItem,
            amount: item.amount,
            type: 'receive',
            token_id: item.id,
            price: 'price' in item ? item.price : undefined,
          });
        });
        sends?.forEach(item => {
          resToken.push({
            token: item as TokenItem,
            amount: item.amount,
            type: 'send',
            token_id: item.id,
            price: 'price' in item ? item.price : undefined,
          });
        });
      }
    }

    return {
      tokenChangeData: resToken,
      tokenApproveData: resApprove,
    };
  }, [data]);

  const formatTitle = useMemo(() => {
    if (data.customActionInfo.customActionTitleType) {
      switch (data.customActionInfo.customActionTitleType) {
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY:
          return t('page.transactions.itemTitle.LendingSupply');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_WITHDRAW:
          return t('page.transactions.itemTitle.LendingWithdraw');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_BORROW:
          return t('page.transactions.itemTitle.LendingBorrow');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY:
          return t('page.transactions.itemTitle.LendingRepay');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL:
          return t('page.transactions.itemTitle.LendingOnCollateral');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL:
          return t('page.transactions.itemTitle.LendingOffCollateral');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE:
          return t('page.transactions.itemTitle.LendingManageEMode');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE:
          return t('page.transactions.itemTitle.LendingManageEModeDisable');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP:
          return t('page.transactions.itemTitle.LendingDebtSwap');
        case CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY_WITH_COLLATERAL:
          return t('page.transactions.itemTitle.LendingRepayWithCollateral');
      }
    }

    switch (formatType) {
      case HistoryItemCateType.GAS_DEPOSIT:
        return t('page.transactions.itemTitle.DepositedGas');
      case HistoryItemCateType.Swap:
        return t('page.transactions.itemTitle.Swap');

      case HistoryItemCateType.Send:
        return t('page.transactions.itemTitle.Send');
      // case HistoryItemCateType.Bridge:
      //   return t('page.transactions.itemTitle.Bridge');

      case HistoryItemCateType.Approve:
        return (
          t('page.transactions.itemTitle.Approve') +
          ' ' +
          ellipsisOverflowedText(getTokenSymbol(tokenApproveData[0].token), 6)
        );
      case HistoryItemCateType.Revoke:
        return t('page.transactions.itemTitle.Revoke', {
          token: ellipsisOverflowedText(
            getTokenSymbol(tokenApproveData[0].token),
            6,
          ),
        });
      case HistoryItemCateType.Cancel:
        return t('page.transactions.itemTitle.Cancel');
      case HistoryItemCateType.UnKnown:
        return t('page.transactions.itemTitle.Default');
      default:
        return t('page.transactions.itemTitle.Default');
    }
  }, [formatType, t, tokenApproveData, data]);

  const formatDescribe = useMemo(() => {
    const ToText = t('page.swap.to') + ' ';

    const chain = findChain({ id: data.maxGasTx.chainId });
    let address: string | React.ReactNode = '';

    switch (formatType) {
      case HistoryItemCateType.GAS_DEPOSIT:
        address = ToText + t('page.home.services.gasAccount');
        break;
      case HistoryItemCateType.Send:
        const acData = data.maxGasTx?.action?.actionData.send;
        const sendRequireData = data.maxGasTx?.action
          ?.requiredData as SendRequireData;
        const addr = acData?.to || sendRequireData?.protocol?.name;
        const cexInfo = getCexInfoByAddress?.(addr || '');

        if (!addr) {
          address = t('page.transactions.detail.Unknown');
        } else {
          if (cexInfo) {
            address = (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.describeText}>{ToText}</Text>
                <FastImage
                  source={{ uri: cexInfo.logo_url }}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    marginHorizontal: 4,
                  }}
                />
                <Text style={styles.describeText}>
                  {getAliasName(addr) || ellipsisAddress(addr)}
                </Text>
              </View>
            );
            break;
          } else {
            address = ToText + (getAliasName(addr) || ellipsisAddress(addr));
          }
        }
        break;
      case HistoryItemCateType.Swap:
        const requireData = data.maxGasTx.action
          ?.requiredData as SwapRequireData;
        address =
          requireData?.protocol?.name || t('page.transactions.detail.Unknown');
        break;
      case HistoryItemCateType.Revoke:
      case HistoryItemCateType.Approve:
      case HistoryItemCateType.Cancel:
      default:
        const appRequireData = data.maxGasTx.action
          ?.requiredData as ApproveTokenRequireData;
        const name = appRequireData?.protocol?.name;
        address =
          name || getAliasName(data.address) || ellipsisAddress(data.address);
        break;
      // case HistoryItemCateType.Cancel:
      // default:
      //   const requiredData = data.maxGasTx.action?.requiredData;
      //   address =
      //     (requiredData as SendRequireData)?.protocol?.name ||
      //     getAliasName(data.address) ||
      //     ellipsisAddress(data.address);
      //   break;
    }

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <ChainIconImage
          size={16}
          chainEnum={chain?.enum}
          isShowRPCStatus={true}
        />
        {typeof address === 'string' ? (
          <Text style={styles.describeText}>{address}</Text>
        ) : (
          address
        )}
      </View>
    );
  }, [formatType, data, t, styles.describeText, getCexInfoByAddress]);

  const handlePressItem = useCallback(() => {
    if (onPressItem) {
      onPressItem({
        isForMultipleAddress,
        data,
        type: formatType,
        canCancel,
        title: formatTitle,
      });
      return;
    }

    if (isInSendHistory) {
      closeHistoryPopup?.();
    }
    naviPush(RootNames.StackTransaction, {
      screen: RootNames.HistoryLocalDetail,
      params: {
        isForMultipleAddress,
        data,
        type: formatType,
        canCancel,
        title: formatTitle,
        onPressAddToWhitelistButton: onPressAddToWhitelistButton,
      },
    });
  }, [
    onPressItem,
    isForMultipleAddress,
    canCancel,
    data,
    formatTitle,
    formatType,
    isInSendHistory,
    onPressAddToWhitelistButton,
    closeHistoryPopup,
  ]);

  useEffect(() => {
    if (!data.isPending && !isInSendHistory) {
      const rawId = `${data.address.toLowerCase()}-${data.maxGasTx.hash}`;
      const isShowStatus =
        transactionHistoryService.clearSuccessAndFailSingleId(rawId);
      isShowStatus && setShowSuccess(true);
    }
  }, [data, isInSendHistory]);

  const noNeedTokenChangeType = useMemo(
    () =>
      [
        HistoryItemCateType.Cancel,
        HistoryItemCateType.Approve,
        HistoryItemCateType.Revoke,
      ].includes(formatType),
    [formatType],
  );

  const isFailed = useMemo(() => {
    return data.isFailed || data.isSubmitFailed || data.isWithdrawed;
  }, [data]);

  return (
    <TouchableOpacity onPress={handlePressItem} style={[styles.card]}>
      <View
        style={[
          styles.leftContent,
          {
            width: noNeedTokenChangeType ? '95%' : '50%',
          },
        ]}>
        <HistoryItemTokenArea
          type={formatType as HistoryItemCateType}
          tokenChangeData={tokenChangeData}
          tokenApproveData={tokenApproveData}
        />
        <View style={styles.textBox}>
          <View style={styles.titleBox}>
            <Text style={styles.titleText} numberOfLines={1}>
              {formatTitle}
            </Text>
            {isShowSuccess ? (
              <TxStatusItem status={1} showSuccess={true} />
            ) : (
              <TxStatusItem
                isPending={data.isPending}
                withText={false}
                status={isFailed ? 0 : 1}
              />
            )}
          </View>
          {formatDescribe}
        </View>
      </View>
      <TxChange
        tokenChangeData={isFailed ? [] : tokenChangeData}
        style={styles.txChange}
      />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight, colors }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingRight: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 8,
    alignItems: 'center',
    gap: 12,
    // borderColor: colors2024['neutral-line'],
    // borderWidth: 1,
  },
  rightContent: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 3,
    minWidth: 0,
    flexShrink: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // width: '50%',
  },
  approveText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  textBox: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  titleBox: {
    flexDirection: 'row',
    gap: 6,
  },
  txChange: { flexShrink: 0, maxWidth: '50%', minWidth: 0 },
  titleText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
  },
  describeText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  textNegative: {
    color: colors['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  tokenText: {
    justifyContent: 'flex-end',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
  },
  sendText: {
    color: colors2024['neutral-title-1'],
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  cardGray: {
    opacity: 0.3,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  nonce: {
    lineHeight: 14,
    fontSize: 12,
    color: colors2024['neutral-foot'],
    marginLeft: 'auto',
    fontFamily: 'SF Pro Rounded',
  },
  body: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  origin: {
    lineHeight: 14,
    fontSize: 12,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
  gas: {
    marginLeft: 'auto',
    lineHeight: 14,
    fontSize: 12,
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
  },
}));
