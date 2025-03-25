/* eslint-disable react-native/no-inline-styles */
import {
  createGlobalBottomSheetModal,
  removeGlobalBottomSheetModal,
} from '@/components/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components/GlobalBottomSheetModal/types';
import {
  CANCEL_TX_TYPE,
  INTERNAL_REQUEST_ORIGIN,
  INTERNAL_REQUEST_SESSION,
} from '@/constant';
import { sendRequest } from '@/core/apis/sendRequest';
import { openapi } from '@/core/request';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { intToHex } from '@ethereumjs/util';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { isArray, maxBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { TransactionCompleteTag } from './TransactionCompleteTag';
import { TransactionExplain } from './TransactionExplain';
import { TransactionPendingDetail } from './TransactionPendingDetail';
import { TransactionPendingTag } from './TransactionPendingTag';
import { toast } from '@/components/Toast';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
} from '@/hooks/account';
import { TransactionAction } from './TransactionAction';
import { apiCustomTestnet, apiProvider } from '@/core/apis';
import { useFindChain } from '@/hooks/useFindChain';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { HistoryItemIcon } from '@/screens/Transaction/components/HistoryItemIcon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TxChange } from '@/screens/Transaction/components/TokenChange';
import {
  ParsedTransactionActionData,
  SendRequireData,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import TokenLabel from '@/screens/Transaction/components/TokenLabel';
import { getTokenSymbol } from '@/utils/token';
import { formatTokenAmount } from '@/utils/number';
import { ellipsisOverflowedText } from '@/utils/text';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { getAlianName, getAliasName } from '@/core/apis/contact';
import { findChain } from '@/utils/chain';
import { transactionHistoryService } from '@/core/services';
import { HistoryItemCateType } from '@/screens/Transaction/components/type';
import { TokenChangeDataItem } from '@/screens/Transaction/components/HistoryItem';
import { HistoryItemTokenArea } from '@/screens/Transaction/components/HistoryItemTokenArea';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { ellipsisAddress } from '@/utils/address';
import { L2_DEPOSIT_ADDRESS_MAP } from '@/constant/gas-account';

export const TransactionItem = ({
  historySuccessList,
  data,
  canCancel,
  onRefresh,
  isForMultipleAdderss,
}: {
  historySuccessList?: string[];
  isForMultipleAdderss?: boolean;
  data: TransactionGroup;
  canCancel?: boolean;
  onRefresh?: () => void;
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
      data.maxGasTx.action?.actionData.unWrapToken ||
      data.maxGasTx.action?.actionData.swap ||
      data.maxGasTx.action?.actionData.crossToken ||
      data.maxGasTx.action?.actionData.crossSwapToken
    ) {
      return HistoryItemCateType.Swap;
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
      data.maxGasTx.action?.actionData.swap ||
      data.maxGasTx.action?.actionData.crossToken ||
      data.maxGasTx.action?.actionData.crossSwapToken
    ) {
      const swapData = (actionData?.swap ||
        actionData?.unWrapToken ||
        actionData?.crossToken ||
        actionData?.crossSwapToken ||
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
        amount: (receive?.amount || receive?.min_amount)!,
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
      const apToken: TokenItem = apData?.token || apData?.nft;
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
        return (
          t('page.transactions.itemTitle.Revoke') +
          ' ' +
          ellipsisOverflowedText(getTokenSymbol(tokenApproveData[0].token), 6)
        );
      case HistoryItemCateType.Cancel:
        return t('page.transactions.itemTitle.Cancel');
      case HistoryItemCateType.UnKnown:
        return t('page.transactions.itemTitle.Default');
      default:
        return t('page.transactions.itemTitle.Default');
    }
  }, [formatType, t, tokenApproveData]);

  const formatDescribe = useMemo(() => {
    const ToText = t('page.swap.to') + ' ';

    const chain = findChain({ id: data.maxGasTx.chainId });
    let address = '';

    switch (formatType) {
      case HistoryItemCateType.GAS_DEPOSIT:
        address = ToText + t('page.home.services.gasAccount');
        break;
      case HistoryItemCateType.Send:
        const acData = data.maxGasTx?.action?.actionData.send;
        const sendRequireData = data.maxGasTx?.action
          ?.requiredData as SendRequireData;
        const addr = acData?.to || sendRequireData?.protocol?.name;

        if (!addr) {
          address = t('page.transactions.detail.Unknown');
        } else {
          address = ToText + (getAliasName(addr) || ellipsisAddress(addr));
        }
        break;
      case HistoryItemCateType.Swap:
        const requireData = data.maxGasTx.action
          ?.requiredData as SwapRequireData;
        address =
          requireData?.protocol?.name || t('page.transactions.detail.Unknown');
        break;
      case HistoryItemCateType.Cancel:
      case HistoryItemCateType.Revoke:
      case HistoryItemCateType.Approve:
      case HistoryItemCateType.Swap:
      default:
        address = getAliasName(data.address) || ellipsisAddress(data.address);
        break;
    }

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <ChainIconImage
          size={16}
          chainEnum={chain?.enum}
          isShowRPCStatus={true}
        />
        <Text style={styles.describeText}>{address}</Text>
      </View>
    );
  }, [formatType, data, t, styles.describeText]);

  const navigation = useRabbyAppNavigation();
  const hanldeNavigateDetail = useCallback(() => {
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.HistoryLocalDetail,
      params: {
        isForMultipleAdderss,
        data,
        canCancel,
        title: formatTitle,
      },
    });
  }, [isForMultipleAdderss, navigation, canCancel, data, formatTitle]);

  useEffect(() => {
    if (!data.isPending) {
      const rawId = `${data.address.toLowerCase()}-${data.maxGasTx.hash}`;
      const isShowStatus =
        transactionHistoryService.clearSuccessAndFailSingleId(rawId);
      isShowStatus && setShowSuccess(true);
    }
  }, [data]);

  const noNeedTokenChangeType = useMemo(
    () =>
      [
        HistoryItemCateType.Cancel,
        HistoryItemCateType.Approve,
        HistoryItemCateType.Revoke,
      ].includes(formatType),
    [formatType],
  );

  return (
    <TouchableOpacity
      onPress={hanldeNavigateDetail}
      style={[styles.card, data.isFailed ? styles.cardGray : null]}>
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
            {isShowSuccess && <TxStatusItem status={1} showSuccess={true} />}
            <TxStatusItem
              isPending={data.isPending}
              withText={false}
              status={1}
            />
          </View>
          {formatDescribe}
        </View>
      </View>
      <TxChange tokenChangeData={tokenChangeData} style={styles.txChange} />
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight, colors }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 8,
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
    fontSize: 16,
    lineHeight: 20,
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
