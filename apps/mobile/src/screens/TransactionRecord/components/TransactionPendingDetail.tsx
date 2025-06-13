/* eslint-disable react-native/no-inline-styles */
import RcIconQuestionCC from '@/assets/icons/transaction-record/icon-question-cc.svg';
import { Tip } from '@/components';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { maxBy, minBy, sortBy } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Spin } from './Spin';
import { CANCEL_TX_TYPE, INTERNAL_REQUEST_SESSION } from '@/constant';
import { useMemoizedFn, useMount } from 'ahooks';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
// import { toast } from '@/components2024/Toast';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { transactionHistoryService } from '@/core/services/shared';
import { apiCustomTestnet } from '@/core/apis/customTestnet';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { useFindChain } from '@/hooks/useFindChain';
import { apiProvider } from '@/core/apis';
import { sendRequest } from '@/core/apis/sendRequest';
import { intToHex } from '@/utils/number';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { CancelTxPopup } from './CancelTxPopup';
import { Button } from '@/components2024/Button';
import { toast } from '@/components/Toast';

export const TransactionPendingDetail = ({
  data,
}: {
  data: TransactionGroup;
}) => {
  const { t } = useTranslation();
  const { styles, colors2024, colors } = useTheme2024({ getStyle });
  const txs = useMemo(() => {
    return sortBy(data?.txs || [], item => -item.createdAt);
  }, [data?.txs]);
  const [isShowCancelTxPopup, setIsShowCancelTxPopup] = useState(false);
  const [canCancel, setCanCancel] = useState(false);

  useMount(() => {
    const { pendings: _pendings, completeds: _completeds } =
      transactionHistoryService.getList(data.address);
    const isCanCancel =
      minBy(
        _pendings.filter(i => i.chainId === data.chainId),
        tx => tx.nonce,
      )?.nonce === data.nonce;
    setCanCancel(isCanCancel);
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
        toast.error((e as any).message);
      }
    }
  };

  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();

  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const chainItem = useFindChain({
    id: data.chainId,
  });
  const navigation = useRabbyAppNavigation();
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
    const gasLevels: GasLevel[] = chainItem?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chainItem?.id!,
        })
      : await apiProvider.gasMarketV2(
          {
            chain: chainItem!,
            tx: maxGasTx.rawTx,
          },
          account,
        );
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;
    try {
      await sendRequest({
        data: {
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
        session: INTERNAL_REQUEST_SESSION,
        account,
      });
    } catch (error) {
      console.error(error);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
    }
    // resetNavigationTo(navigation, 'Home');
  };

  /**
   * @deprecated
   */
  const handleRemoveLocalPendingTx = useMemoizedFn(async () => {
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

    const maxGasTx = data.maxGasTx;
    try {
      apisTransactionHistory.removeLocalPendingTx({
        chainId: maxGasTx.rawTx.chainId,
        nonce: +maxGasTx.rawTx.nonce,
        address: maxGasTx.rawTx.from,
      });
      toast.success(t('page.activities.signedTx.message.deleteSuccess'));
      // resetNavigationTo(navigation, 'Home');
    } catch (e) {
      toast.info((e as any).message);
    }
  });

  const handleTxCancelPress = useMemoizedFn(() => {
    if (!canCancel) {
      toast.info(t('page.activities.signedTx.tips.canNotCancel'));
      return;
    }
    setIsShowCancelTxPopup(true);
  });
  const handleTxCancel = useMemoizedFn((mode: CANCEL_TX_TYPE) => {
    if (mode === CANCEL_TX_TYPE.QUICK_CANCEL) {
      handleQuickCancel();
    }
    if (mode === CANCEL_TX_TYPE.ON_CHAIN_CANCEL) {
      handleOnChainCancel();
    }
    if (mode === CANCEL_TX_TYPE.REMOVE_LOCAL_PENDING_TX) {
      handleRemoveLocalPendingTx();
    }
    setIsShowCancelTxPopup(false);
  });

  const handleTxSpeedUp = useMemoizedFn(async () => {
    if (!canCancel) {
      toast.info(t('page.activities.signedTx.tips.canNotCancel'));
      return;
    }
    console.log('handleTxSpeedUp111');
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
    console.log('handleTxSpeedUp1222');
    if (!account) {
      throw Error('No account find');
    }

    await switchSceneSigningAccount('MultiHistory', account);
    const gasLevels: GasLevel[] = chainItem?.isTestnet
      ? await apiCustomTestnet.getCustomTestnetGasMarket({
          chainId: chainItem?.id!,
        })
      : await apiProvider.gasMarketV2(
          {
            chain: chainItem!,
            tx: originTx.rawTx,
          },
          account,
        );
    const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;

    try {
      await sendRequest({
        data: {
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
        session: INTERNAL_REQUEST_SESSION,
        account,
      });
    } catch (error) {
      console.error(error);
    } finally {
      await switchSceneSigningAccount('MultiHistory', null);
    }
    // resetNavigationTo(navigation, 'Home');
  });

  if (!data || !data?.isPending || data.txs.length <= 0) {
    return null;
  }
  return (
    <View>
      <CancelTxPopup
        tx={data.maxGasTx}
        visible={isShowCancelTxPopup}
        onCancelTx={handleTxCancel}
        onClose={() => {
          setIsShowCancelTxPopup(false);
        }}
      />
      <View style={styles.container}>
        <View style={styles.detail}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {t('page.activities.signedTx.common.pendingDetail')}
            </Text>
            <Tip content={t('page.activities.signedTx.tips.pendingDetail')}>
              <TouchableOpacity>
                <RcIconQuestionCC color={colors['neutral-foot']} />
              </TouchableOpacity>
            </Tip>
          </View>
          <View style={styles.list}>
            {txs.map((tx, index) => {
              return (
                <View
                  style={[styles.row, index !== 0 && styles.rowGray]}
                  key={index}>
                  <Text style={styles.txType}>
                    {tx === data.originTx
                      ? 'Initial tx'
                      : isSameAddress(tx.rawTx.from, tx.rawTx.to)
                      ? 'Cancel tx'
                      : 'Speed up tx'}
                  </Text>
                  <Text style={styles.gas}>
                    {Number(tx.rawTx.gasPrice || tx.rawTx.maxFeePerGas || 0) /
                      1e9}{' '}
                    Gwei
                  </Text>
                  <Spin
                    color={colors2024['neutral-body']}
                    style={styles.spin}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.buttonContainer}>
            <View style={{ flex: 1 }}>
              <Button
                titleStyle={[styles.ghostTitle]}
                buttonStyle={[styles.ghostButton]}
                onPress={handleTxCancelPress}
                // disabled={!canCancel}
                title={t('page.transactions.detail.Cancel')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                titleStyle={[styles.primaryTitle]}
                buttonStyle={[styles.primaryButton]}
                onPress={handleTxSpeedUp}
                title={t('page.transactions.detail.SpeedUp')}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  container: {
    paddingHorizontal: 8,
  },
  ghostButton: {
    height: 36,
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
    borderRadius: 8,
  },
  primaryButton: {
    height: 36,
    borderRadius: 8,
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['brand-default'],
  },
  primaryTitle: {
    color: colors2024['brand-default'],
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 16,
    width: '100%',
    gap: 16,
  },
  detail: {
    backgroundColor: colors['neutral-card2'],
    padding: 12,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  title: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  list: {
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
  },
  rowGray: {
    opacity: 0.5,
  },
  txType: {
    color: colors['neutral-foot'],
    fontSize: 13,
    lineHeight: 16,
    width: 142,
  },
  gas: {
    color: colors['neutral-foot'],
    fontSize: 13,
    lineHeight: 16,
  },
  spin: {
    marginLeft: 'auto',
  },
}));
