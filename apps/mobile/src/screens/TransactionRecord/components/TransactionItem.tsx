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
import { AppColorsVariants } from '@/constant/theme';
import { sendRequest } from '@/core/apis/sendRequest';
import { openapi } from '@/core/request';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useThemeColors } from '@/hooks/theme';
import { findChainByID } from '@/utils/chain';
import { intToHex } from '@ethereumjs/util';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { useMemoizedFn } from 'ahooks';
import { maxBy } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { TransactionCompleteTag } from './TransactionCompleteTag';
import { TransactionExplain } from './TransactionExplain';
import { TransactionPendingDetail } from './TransactionPendingDetail';
import { TransactionPendingTag } from './TransactionPendingTag';
import { toast } from '@/components/Toast';
import { useCurrentAccount } from '@/hooks/account';
import { TransactionAction } from './TransactionAction';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { apiCustomTestnet } from '@/core/apis';
import { useFindChain } from '@/hooks/useFindChain';

export const TransactionItem = ({
  data,
  canCancel,
  onRefresh,
}: {
  data: TransactionGroup;
  canCancel?: boolean;
  onRefresh?: () => void;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const chain = useFindChain({
    id: data.chainId,
  });
  const { t } = useTranslation();
  const isCanceled =
    data.isCompleted &&
    isSameAddress(data?.maxGasTx?.rawTx?.from, data?.maxGasTx?.rawTx?.to);

  const { currentAccount } = useCurrentAccount();

  const handleTxSpeedUp = useMemoizedFn(async () => {
    if (!canCancel) {
      return;
    }
    const maxGasTx = data.maxGasTx;
    const originTx = data.originTx!;
    const maxGasPrice = Number(
      maxGasTx.rawTx.gasPrice || maxGasTx.rawTx.maxFeePerGas || 0,
    );

    const gasLevels: GasLevel[] = chain?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chain?.id!,
        })
      : await openapi.gasMarket(chain?.serverId!);
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;

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
    const maxGasTx = data.maxGasTx;
    const maxGasPrice = Number(
      maxGasTx.rawTx.gasPrice || maxGasTx.rawTx.maxFeePerGas || 0,
    );
    const gasLevels: GasLevel[] = chain?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chain?.id!,
        })
      : await openapi.gasMarket(chain?.serverId!);
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;
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
    onRefresh?.();
  };

  return (
    <View
      style={[
        styles.card,
        isCanceled || data.isFailed || data.isSubmitFailed || data.isWithdrawed
          ? styles.cardGray
          : null,
      ]}>
      <View style={styles.header}>
        <TransactionPendingTag data={data} />
        {data.isCompleted ? <TransactionCompleteTag /> : null}
        <Text style={styles.nonce}>
          {chain?.name || 'Unknown'} #{data?.nonce}
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.body}>
          <TransactionExplain
            isCanceled={isCanceled}
            isFailed={data.isFailed}
            isSubmitFailed={data.isSubmitFailed}
            isWithdrawed={data.isWithdrawed}
            explain={data.originTx?.explain}
          />
          {data?.isPending &&
          ![
            KEYRING_TYPE.WatchAddressKeyring,
            KEYRING_TYPE.WalletConnectKeyring,
          ].includes(currentAccount?.type!) ? (
            <TransactionAction
              canCancel={canCancel}
              onTxCancel={handleTxCancel}
              onTxSpeedUp={handleTxSpeedUp}
            />
          ) : null}
        </View>
        <View style={styles.footer}>
          {data?.originTx?.site ? (
            <Text style={styles.origin}>
              {data?.originTx?.site?.origin === INTERNAL_REQUEST_ORIGIN
                ? 'Rabby Wallet'
                : data?.originTx?.site?.origin}
            </Text>
          ) : null}
          {!(data.isWithdrawed || data.isSubmitFailed) ? (
            <Text style={styles.gas}>
              {Number(
                data.maxGasTx?.rawTx.gasPrice ||
                  data.maxGasTx?.rawTx.maxFeePerGas ||
                  0,
              ) / 1e9}{' '}
              Gwei{' '}
            </Text>
          ) : (
            <Text style={styles.gas}>No Gas cost</Text>
          )}
        </View>
      </View>
      <TransactionPendingDetail data={data} />
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    card: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card1'],
      marginBottom: 12,
      paddingBottom: 4,
    },
    cardGray: {
      opacity: 0.5,
    },
    content: {
      paddingHorizontal: 12,
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
      color: colors['neutral-foot'],
      marginLeft: 'auto',
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
      color: colors['neutral-foot'],
    },
    gas: {
      marginLeft: 'auto',
      lineHeight: 14,
      fontSize: 12,
      color: colors['neutral-foot'],
    },
  });
