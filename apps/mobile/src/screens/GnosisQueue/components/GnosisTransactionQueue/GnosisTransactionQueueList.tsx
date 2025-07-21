import {
  IconLoadFailed,
  RcIconEmptyCC,
  RcIconInfoCC,
} from '@/assets/icons/gnosis';
import { CHAINS_ENUM } from '@/constant/chains';
import { apisSafe } from '@/core/apis/safe';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { useGnosisSafeInfo } from '@/hooks/gnosis/useGnosisSafeInfo';
import { useThemeColors } from '@/hooks/theme';
import { findChain } from '@/utils/chain';
import { validateEOASign, validateETHSign } from '@/utils/gnosis';
import { createGetStyles } from '@/utils/styles';
import type { SafeTransactionDataPartial } from '@safe-global/types-kit';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import type { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import type { SafeTransactionItem } from '@rabby-wallet/gnosis-sdk/dist/api';
import { useMemoizedFn } from 'ahooks';
import dayjs from 'dayjs';
import { groupBy } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  ListRenderItemInfo,
  Text,
  View,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { numberToHex, toChecksumAddress } from 'web3-utils';
import { GnosisTransactionItem } from './GnosisTransactionItem';
import { AccountSelectPopup } from '@/components/AccountSelectPopup';
import { intToHex } from '@/utils/number';
import { toast } from '@/components/Toast';
import { StackActions, useNavigation } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { Account } from '@/core/services/preference';

export type ConfirmationProps = {
  owner: string;
  type: string;
  hash: string;
  signature: string | null;
};

const validateConfirmation = (
  txHash: string,
  signature: string,
  ownerAddress: string,
  type: string,
  version: string,
  safeAddress: string,
  tx: SafeTransactionDataPartial,
  networkId: number,
  owners: string[],
) => {
  if (!owners.find(owner => isSameAddress(owner, ownerAddress))) return false;
  switch (type) {
    case 'EOA':
      try {
        return validateEOASign(
          signature,
          ownerAddress,
          tx,
          version,
          safeAddress,
          networkId,
        );
      } catch (e) {
        return false;
      }
    case 'ETH_SIGN':
      try {
        return validateETHSign(signature, txHash, ownerAddress);
      } catch (e) {
        return false;
      }
    default:
      return false;
  }
};

const Item = React.memo(
  ({
    nonce,
    txs,
    safeInfo,
    networkId,
    onSubmit,
    reload,
    account,
  }: {
    nonce: string;
    txs: SafeTransactionItem[];
    safeInfo?: BasicSafeInfo | null;
    networkId?: string | null;
    onSubmit(data: SafeTransactionItem): void;
    reload?: () => void;
    account: Account;
  }) => {
    const themeColors = useThemeColors();
    const styles = useMemo(() => getStyles(themeColors), [themeColors]);
    const { t } = useTranslation();
    if (!safeInfo) {
      return null;
    }
    return (
      <>
        {txs.length > 1 ? (
          <View style={styles.queueGroup} key={nonce}>
            <View style={styles.queueGroupHeader}>
              <RcIconInfoCC
                color={themeColors['blue-default']}
                width={12}
                height={12}
                style={styles.iconInformation}
              />
              <Text style={styles.queueGroupHeaderText}>
                {t('page.safeQueue.sameNonceWarning')}
              </Text>
            </View>
            {txs.map((transaction, idx, _list) => (
              <GnosisTransactionItem
                style={
                  idx + 1 !== _list.length
                    ? styles.queueItem
                    : styles.queueItemLastChild
                }
                data={transaction}
                networkId={networkId!}
                safeInfo={safeInfo}
                key={transaction.safeTxHash}
                onSubmit={onSubmit}
                reload={reload}
                account={account}
              />
            ))}
          </View>
        ) : (
          txs.map(transaction => (
            <GnosisTransactionItem
              data={transaction}
              networkId={networkId!}
              safeInfo={safeInfo}
              key={transaction.safeTxHash}
              onSubmit={onSubmit}
              reload={reload}
              account={account}
            />
          ))
        )}
      </>
    );
  },
);

export const GnosisTransactionQueueList = (props: {
  reload?: () => void;
  usefulChain: CHAINS_ENUM;
  pendingTxs?: SafeTransactionItem[];
  loading?: boolean;
  account: Account;
}) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => getStyles(themeColors), [themeColors]);
  const {
    usefulChain: chain,
    pendingTxs,
    loading,
    reload,
    account: currentAccount,
  } = props;
  const networkId = findChain({
    enum: chain,
  })?.network;
  // const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const { t } = useTranslation();
  const [transactionsGroup, setTransactionsGroup] = useState<
    Record<string, SafeTransactionItem[]>
  >({});
  const [submitDrawerVisible, setSubmitDrawerVisible] = useState(false);
  const [submitTransaction, setSubmitTransaction] =
    useState<SafeTransactionItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadFailed, setIsLoadFailed] = useState(false);

  const { data: safeInfo, loading: isSafeInfoLoading } = useGnosisSafeInfo({
    address: currentAccount?.address,
    networkId,
  });

  const init = useMemoizedFn(
    async (txs: SafeTransactionItem[], info: BasicSafeInfo) => {
      if (!currentAccount || !networkId) {
        return;
      }
      try {
        const txHashValidation = await Promise.all(
          txs.map(async safeTx => {
            const tx: SafeTransactionDataPartial = {
              data: safeTx.data || '0x',
              gasPrice: safeTx.gasPrice || '0',
              gasToken: safeTx.gasToken,
              refundReceiver: safeTx.refundReceiver,
              to: safeTx.to,
              value: numberToHex(safeTx.value),
              safeTxGas: safeTx.safeTxGas.toString(),
              nonce: +safeTx.nonce,
              operation: safeTx.operation,
              baseGas: safeTx.baseGas.toString(),
            };
            return apisSafe.validateGnosisTransaction(
              {
                account: currentAccount,
                tx,
                version: info.version,
                networkId,
              },
              safeTx.safeTxHash,
            );
          }),
        );

        setIsLoading(false);

        const transactions = txs
          .filter((safeTx, index) => {
            if (!txHashValidation[index]) {
              return false;
            }
            const tx: SafeTransactionDataPartial = {
              data: safeTx.data || '0x',
              gasPrice: safeTx.gasPrice || '0',
              gasToken: safeTx.gasToken,
              refundReceiver: safeTx.refundReceiver,
              to: safeTx.to,
              value: numberToHex(safeTx.value),
              safeTxGas: safeTx.safeTxGas.toString(),
              nonce: +safeTx.nonce,
              operation: safeTx.operation,
              baseGas: safeTx.baseGas.toString(),
            };

            return safeTx.confirmations.every(confirm =>
              validateConfirmation(
                safeTx.safeTxHash,
                confirm.signature,
                confirm.owner,
                confirm.signatureType,
                info.version,
                info.address,
                tx,
                Number(networkId),
                info.owners,
              ),
            );
          })
          .sort((a, b) => {
            return dayjs(a.submissionDate).isAfter(dayjs(b.submissionDate))
              ? -1
              : 1;
          });
        setTransactionsGroup(groupBy(transactions, 'nonce'));
      } catch (e) {
        console.error(e);
        setIsLoading(false);
        setIsLoadFailed(true);
      }
    },
  );

  const list = useMemo(() => {
    return Object.keys(transactionsGroup);
  }, [transactionsGroup]);

  const handleSubmit = useMemoizedFn(
    async (transaction: SafeTransactionItem) => {
      setSubmitTransaction(transaction);
      setSubmitDrawerVisible(true);
    },
  );
  const navigation = useNavigation();
  const handleConfirm = async (account: KeyringAccountWithAlias) => {
    if (!safeInfo) {
      return;
    }
    const data = submitTransaction;
    if (!data || !currentAccount || !networkId) {
      return;
    }
    try {
      setIsSubmitting(true);
      const params = {
        from: toChecksumAddress(data.safe),
        to: data.to,
        data: data.data || '0x',
        value: numberToHex(data.value),
        nonce: intToHex(+data.nonce),
        safeTxGas: data.safeTxGas,
        gasPrice: Number(data.gasPrice),
        baseGas: data.baseGas,
        operation: data.operation,
      };
      await apisSafe.buildGnosisTransaction(
        currentAccount!.address,
        account,
        params,
        safeInfo?.version,
        networkId,
      );
      await Promise.all(
        data.confirmations.map(confirm => {
          return apisSafe.gnosisAddPureSignature(
            confirm.owner,
            confirm.signature,
          );
        }),
      );
      await apisSafe.execGnosisTransaction(account);
      toast.success('Submitted');
      setIsSubmitting(false);
      setSubmitDrawerVisible(false);
      setSubmitTransaction(null);
      reload?.();
      navigation.dispatch(
        StackActions.replace(RootNames.StackRoot, {
          screen: RootNames.Home,
        }),
      );
    } catch (e: any) {
      // toast.info(e.message || JSON.stringify(e));
      console.log('execGnosisTransaction error', e);
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSubmitDrawerVisible(false);
    setSubmitTransaction(null);
  };

  useEffect(() => {
    if (pendingTxs && safeInfo) {
      init(pendingTxs || [], safeInfo);
    }
  }, [init, pendingTxs, safeInfo]);

  const renderItem = useMemoizedFn((item: ListRenderItemInfo<string>) => {
    const nonce = item.item;
    return (
      <Item
        account={currentAccount}
        nonce={nonce}
        safeInfo={safeInfo}
        txs={transactionsGroup[nonce]}
        networkId={networkId}
        onSubmit={handleSubmit}
        reload={reload}
      />
    );
  });

  return (
    <View style={[styles.container]}>
      <FlatList
        data={list}
        style={styles.queueList}
        keyExtractor={item => item}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.txHistoryEmpty}>
            {isLoading || loading || isSafeInfoLoading ? (
              <View>
                <ActivityIndicator
                  size={20}
                  color={themeColors['neutral-foot']}
                />
                <Text style={styles.loadingText}>
                  {t('page.safeQueue.loading')}
                </Text>
              </View>
            ) : isLoadFailed ? (
              <View style={styles.loadFailed}>
                <Image style={styles.loadFailedImage} source={IconLoadFailed} />
                <Text style={styles.loadFailedDesc}>
                  {t('page.safeQueue.loadingFaild')}
                </Text>
              </View>
            ) : (
              <View style={styles.empty}>
                <RcIconEmptyCC
                  color={themeColors['neutral-body']}
                  width={32}
                  height={32}
                />
                <Text style={styles.noDataText}>
                  {t('page.safeQueue.noData')}
                </Text>
              </View>
            )}
          </View>
        }
      />
      <AccountSelectPopup
        visible={submitDrawerVisible}
        onChange={handleConfirm}
        title={t('page.safeQueue.accountSelectTitle')}
        onCancel={handleCancel}
        isLoading={isSubmitting}
        networkId={networkId!}
        owners={safeInfo?.owners}
      />
    </View>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    flex: 1,
    // paddingVertical: 20,
    paddingTop: 20,
  },
  queueList: {
    paddingHorizontal: 20,
  },

  queueGroup: {
    backgroundColor: colors['neutral-card-1'],
    borderWidth: 1,
    borderColor: colors['blue-default'],
    borderRadius: 6,
    marginBottom: 20,
  },
  queueGroupHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors['blue-default'],
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 5,
  },
  queueGroupHeaderText: {
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: colors['blue-default'],
    minWidth: 0,
    flex: 1,
  },
  iconInformation: {
    width: 12,
    height: 12,
    marginTop: 2,
  },
  queueItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors['blue-default'],
    borderRadius: 0,
    marginBottom: 0,
    backgroundColor: 'transparent',
  },
  queueItemLastChild: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  txHistoryEmpty: {
    paddingTop: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 16,
    color: colors['neutral-body'],
  },
  loadFailed: {
    alignItems: 'center',
  },
  loadFailedImage: {
    width: 32,
    height: 32,
  },
  loadFailedDesc: {
    fontSize: 13,
    color: colors['neutral-body'],
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 13,
    color: colors['neutral-body'],
    marginTop: 12,
  },
}));
