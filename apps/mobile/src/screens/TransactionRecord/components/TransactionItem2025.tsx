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
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
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
import {
  HistoryItemCateType,
  HistoryItemIcon,
} from '@/screens/Transaction/components/HistoryItemIcon';
import { useCallback, useMemo } from 'react';
import { TxChange } from '@/screens/Transaction/components/TokenChange';
import {
  ParsedTransactionActionData,
  SwapRequireData,
} from '@rabby-wallet/rabby-action';
import { strings } from '@/utils/i18n';
import TokenLabel from '@/screens/Transaction/components/TokenLabel';
import { getTokenSymbol } from '@/utils/token';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { ellipsisOverflowedText } from '@/utils/text';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { TxStatusItem } from '@/screens/Transaction/HistoryDetailScreen';
import { getAlianName } from '@/core/apis/contact';

export function findAccountByPriority(accounts: KeyringAccountWithAlias[]) {
  const priority = {
    [KEYRING_TYPE.HdKeyring]: 1,
    [KEYRING_TYPE.SimpleKeyring]: 2,
    [KEYRING_TYPE.LedgerKeyring]: 3,
    [KEYRING_TYPE.OneKeyKeyring]: 4,
    [KEYRING_TYPE.KeystoneKeyring]: 5,
    [KEYRING_TYPE.GnosisKeyring]: 6,
  };

  return accounts.sort((item1, item2) => {
    return (priority[item1.type] || 100) - (priority[item2.type] || 100);
  })[0];
}

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
  const chain = useFindChain({
    id: data.chainId,
  });
  const { t } = useTranslation();
  const isCanceled =
    data.isCompleted &&
    isSameAddress(data?.maxGasTx?.rawTx?.from, data?.maxGasTx?.rawTx?.to);
  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();
  const isShowSuccess = useMemo(
    () => historySuccessList?.includes(data.maxGasTx.hash || ''),
    [data.maxGasTx.hash, historySuccessList],
  );

  const { accounts } = useAccounts();

  const handleTxSpeedUp = useMemoizedFn(async () => {
    if (!canCancel) {
      return;
    }
    const maxGasTx = data.maxGasTx;
    const originTx = data.originTx!;
    const keyringType = data.keyringType;
    const maxGasPrice = Number(
      maxGasTx.rawTx.gasPrice || maxGasTx.rawTx.maxFeePerGas || 0,
    );
    let account: KeyringAccountWithAlias | undefined;
    const canUseAccountList = accounts.filter(acc => {
      return (
        isSameAddress(acc.address, data.address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    if (keyringType) {
      account = canUseAccountList.find(acc => acc.type === data.keyringType);
    }
    if (!account) {
      account = findAccountByPriority(canUseAccountList);
    }
    if (!account) {
      throw Error('No account find');
    }

    await switchSceneSigningAccount('MultiHistory', account);
    const gasLevels: GasLevel[] = chain?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chain?.id!,
        })
      : await apiProvider.gasMarketV2({
          chain: chain!,
          tx: originTx.rawTx,
        });
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;

    try {
      await sendRequest(
        {
          method: 'eth_sendTransaction',
          params: [
            {
              from: originTx.rawTx.from,
              value: originTx.rawTx.value,
              data: originTx.rawTx.data,
              nonce: originTx.rawTx.nonce,
              chainId: originTx.rawTx.chainId,
              to: originTx.rawTx.to,
              gasPrice: intToHex(
                Math.round(Math.max(maxGasPrice * 2, maxGasMarketPrice)),
              ),
              isSpeedUp: true,
              reqId: maxGasTx.reqId,
            },
          ],
        },
        INTERNAL_REQUEST_SESSION,
      );
    } catch (error) {
      console.error(error);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
    }
    onRefresh?.();
  });

  const handleTxCancel = useMemoizedFn(() => {
    const id = createGlobalBottomSheetModal({
      name: MODAL_NAMES.CANCEL_TX_POPUP,
      tx: data.maxGasTx,
      onCancelTx: (mode: CANCEL_TX_TYPE) => {
        if (mode === CANCEL_TX_TYPE.QUICK_CANCEL) {
          handleQuickCancel();
        }
        if (mode === CANCEL_TX_TYPE.ON_CHAIN_CANCEL) {
          handleOnChainCancel();
        }
        removeGlobalBottomSheetModal(id);
      },
    });
  });

  const handleQuickCancel = async () => {
    const maxGasTx = data.maxGasTx;
    if (maxGasTx?.reqId) {
      try {
        // todo
        // await wallet.quickCancelTx({
        //   reqId: maxGasTx.reqId,
        //   chainId: maxGasTx.rawTx.chainId,
        //   nonce: +maxGasTx.rawTx.nonce,
        //   address: maxGasTx.rawTx.from,
        // });
        // onQuickCancel?.();
        toast.success(t('page.activities.signedTx.message.cancelSuccess'));
      } catch (e) {
        toast.info((e as any).message);
      }
    }
  };

  const handleOnChainCancel = async () => {
    if (!canCancel) {
      return;
    }
    const keyringType = data.keyringType;
    let account: KeyringAccountWithAlias | undefined;
    const canUseAccountList = accounts.filter(acc => {
      return (
        isSameAddress(acc.address, data.address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });
    if (keyringType) {
      account = canUseAccountList.find(acc => acc.type === data.keyringType);
    }
    if (!account) {
      account = findAccountByPriority(canUseAccountList);
    }
    if (!account) {
      throw Error('No account find');
    }

    await switchSceneSigningAccount('MultiHistory', account);
    const maxGasTx = data.maxGasTx;
    const maxGasPrice = Number(
      maxGasTx.rawTx.gasPrice || maxGasTx.rawTx.maxFeePerGas || 0,
    );
    const gasLevels: GasLevel[] = chain?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chain?.id!,
        })
      : await apiProvider.gasMarketV2({
          chain: chain!,
          tx: maxGasTx.rawTx,
        });
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;
    try {
      await sendRequest(
        {
          method: 'eth_sendTransaction',
          params: [
            {
              from: maxGasTx.rawTx.from,
              to: maxGasTx.rawTx.from,
              gasPrice: intToHex(Math.max(maxGasPrice * 2, maxGasMarketPrice)),
              value: '0x0',
              chainId: data.chainId,
              nonce: intToHex(data.nonce),
              isCancel: true,
              reqId: maxGasTx.reqId,
            },
          ],
        },
        INTERNAL_REQUEST_SESSION,
      );
    } catch (error) {
      console.error(error);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
    }
    onRefresh?.();
  };

  const formatType: HistoryItemCateType = useMemo(() => {
    if (data.maxGasTx.action?.actionData.send) {
      return HistoryItemCateType.Send;
    }

    if (data.maxGasTx.action?.actionData.wrapToken) {
      return HistoryItemCateType.Swap;
    }

    if (data.maxGasTx.action?.actionData.swap) {
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

    // if (data.txs?.[0]?.$ctx.ga.category === 'Bridge') {
    //   return HistoryItemCateType.Bridge;
    // }

    return HistoryItemCateType.UnKnown;
  }, [data]);

  const { sendToken, receiveToken, isNft, approveToken } = useMemo(() => {
    switch (formatType) {
      case HistoryItemCateType.Send:
        const acData = data.txs?.[0]?.action?.actionData.send;

        return {
          sendToken: acData?.token!,
          isNft: false,
        };
      case HistoryItemCateType.Swap:
        const actionData =
          data.txs?.[0]?.action?.actionData.swap ||
          data.txs?.[0]?.action?.actionData.wrapToken;
        const send = actionData?.payToken!;
        const receive = actionData?.receiveToken!;

        return {
          sendToken: send,
          receiveToken: receive,
          isNft: false,
        };
      case HistoryItemCateType.Revoke: {
        const reToken = data.txs?.[0]?.action?.actionData.revokeToken;

        return {
          approveToken: reToken?.token!,
          isNft: reToken?.token?.id.length === 32,
        };
      }
      case HistoryItemCateType.Approve: {
        const apToken = data.txs?.[0]?.action?.actionData.approveToken;

        return {
          approveToken: apToken?.token!,
          isNft: apToken?.token?.id.length === 32,
        };
      }
      default:
        return {
          isNft: false,
        };
    }
  }, [data, formatType]);

  const formatTitle = useMemo(() => {
    switch (formatType) {
      case HistoryItemCateType.Swap:
        return strings('page.transactions.itemTitle.Swap');

      case HistoryItemCateType.Send:
        return strings('page.transactions.itemTitle.Send');
      // case HistoryItemCateType.Bridge:
      //   return strings('page.transactions.itemTitle.Bridge');

      case HistoryItemCateType.Approve:
        return strings('page.transactions.itemTitle.Approve');

      case HistoryItemCateType.Revoke:
        return strings('page.transactions.itemTitle.Revoke');
      case HistoryItemCateType.Cancel:
        return strings('page.transactions.itemTitle.Cancel');
      case HistoryItemCateType.UnKnown:
        return strings('page.transactions.itemTitle.Default');
      default:
        return strings('page.transactions.itemTitle.Default');
    }
  }, [formatType]);

  const formatDescribe = useMemo(() => {
    const FromText = strings('page.swap.from') + ' ';
    const ToText = strings('page.swap.to') + ' ';

    const requiredData = data.maxGasTx.action?.requiredData as SwapRequireData;
    const projectName = requiredData.protocol?.name || '';

    switch (formatType) {
      case HistoryItemCateType.Swap:
        return projectName || strings('page.transactions.detail.Unknown');

      case HistoryItemCateType.Send:
        const acData = data.txs?.[0]?.action?.actionData.send;
        const addr = acData?.to;

        if (!addr) {
          return strings('page.transactions.detail.Unknown');
        }

        return ToText + (getAlianName(addr) || ellipsisOverflowedText(addr));
      // case HistoryItemCateType.Recieve:
      //   const isSend = formatType === HistoryItemCateType.Send;
      //   const addr = isSend
      //     ? data.sends[0].to_addr
      //     : data.receives[0].from_addr;
      //   return (
      //     (isSend ? ToText : FromText) +
      //     (getAliasName(addr) || ellipsisAddress(addr))
      //   );
      case HistoryItemCateType.Revoke:
      case HistoryItemCateType.Approve:
        const isApprove = formatType === HistoryItemCateType.Approve;
        return projectName
          ? isApprove
            ? ToText
            : FromText + projectName
          : strings('page.transactions.detail.Unknown');
      // case HistoryItemCateType.Contract:
      //   return FromText + chainItem?.name;
      // case HistoryItemCateType.Cancel:
      default:
        return strings('page.transactions.detail.Unknown');
    }
  }, [formatType, data]);

  const formatSymbolName = useCallback(
    token => {
      const symbol = isNft ? '' : getTokenSymbol(token);

      return isNft
        ? strings('page.nft.title')
        : ellipsisOverflowedText(symbol, 6);
    },
    [isNft],
  );

  const sendsToken = useMemo(() => {
    return [sendToken];
  }, [sendToken]);

  const recievesToken = useMemo(() => {
    return [receiveToken];
  }, [receiveToken]);

  const navigation = useRabbyAppNavigation();
  const hanldeNavigateDetail = useCallback(() => {
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.HistoryLocalDetail,
      params: {
        isForMultipleAdderss,
        data,
        canCancel,
        sendsToken,
        recievesToken,
        approveToken,
        formatType,
        title: formatTitle,
      },
    });
  }, [
    formatType,
    approveToken,
    isForMultipleAdderss,
    navigation,
    canCancel,
    data,
    formatTitle,
    recievesToken,
    sendsToken,
  ]);

  const approveTokenAmountStr = useMemo(() => {
    const amount = approveToken?.amount;
    if (!amount) {
      return '';
    } else {
      if (isNft) {
        return approveToken.amount;
      } else {
        return amount >= 1e9
          ? strings('page.transactions.detail.Unlimited')
          : numberWithCommasIsLtOne(amount, 2);
      }
    }
  }, [approveToken, isNft]);

  const formatToken = useMemo(() => {
    const tempArr = [sendToken!, receiveToken!, approveToken!].filter(
      token => token,
    );
    if (tempArr.length === 0) {
      return undefined;
    }

    if (tempArr.length === 1) {
      return tempArr[0];
    } else {
      return tempArr;
    }
  }, [sendToken, receiveToken, approveToken]);

  return (
    <TouchableOpacity
      onPress={hanldeNavigateDetail}
      style={[
        styles.card,
        isCanceled || data.isFailed || data.isSubmitFailed || data.isWithdrawed
          ? styles.cardGray
          : null,
      ]}>
      <View style={styles.leftContent}>
        <HistoryItemIcon
          type={formatType as HistoryItemCateType}
          token={formatToken}
          isNft={isNft}
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
          <Text style={styles.describeText} numberOfLines={1}>
            {formatDescribe}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.rightContent,
          isCanceled ||
          data.isPending ||
          data.isFailed ||
          data.isSubmitFailed ||
          data.isWithdrawed
            ? styles.cardGray
            : null,
        ]}>
        {approveToken && (
          <View style={styles.txChange}>
            <Text style={[styles.tokenText]} numberOfLines={1}>
              {approveTokenAmountStr}
            </Text>
            <Text
              style={[
                styles.tokenText,
                !approveToken.amount && styles.sendText,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {formatSymbolName(approveToken)}
            </Text>
          </View>
        )}
        {recievesToken.map(
          (token, index) =>
            token && (
              <View key={index} style={styles.txChange}>
                <Text style={[styles.tokenText]} numberOfLines={1}>
                  {'+'}{' '}
                  {isNft
                    ? token.amount
                    : numberWithCommasIsLtOne(token.amount, 2)}
                </Text>
                <Text
                  style={[styles.tokenText]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {formatSymbolName(token)}
                </Text>
              </View>
            ),
        )}
        {sendsToken.map(
          (token, index) =>
            token && (
              <View key={index} style={styles.txChange}>
                <Text
                  style={[styles.tokenText, styles.sendText]}
                  numberOfLines={1}>
                  {'-'}{' '}
                  {isNft
                    ? token.amount
                    : numberWithCommasIsLtOne(token.amount, 2)}
                </Text>
                <Text
                  style={[styles.tokenText, styles.sendText]}
                  numberOfLines={1}
                  ellipsizeMode="tail">
                  {formatSymbolName(token)}
                </Text>
              </View>
            ),
        )}
      </View>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024, isLight, colors }) => ({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 12,
    // borderColor: colors2024['neutral-line'],
    // borderWidth: 1,
  },
  rightContent: {
    flexDirection: 'column',
    justifyContent: 'center',
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
  textBox: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  titleBox: {
    flexDirection: 'row',
    gap: 6,
  },
  txChange: { flexShrink: 0, flexDirection: 'row', gap: 4 },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors['green-default'],
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
  },
  sendText: {
    color: colors2024['neutral-title-1'],
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
