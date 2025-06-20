import { RcIconWarningCC } from '@/assets2024/icons/common';
import { toast } from '@/components2024/Toast';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { apiCustomTestnet, apiProvider } from '@/core/apis';
import { sendRequest } from '@/core/apis/sendRequest';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import { useTheme2024 } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { findAccountByPriority } from '@/utils/account';
import { findChain } from '@/utils/chain';
import { intToHex } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { useInterval, useMemoizedFn, useRequest, useSetState } from 'ahooks';
import dayjs from 'dayjs';
import { flatten, flattenDeep, groupBy, maxBy, sortBy, uniqBy } from 'lodash';
import { useMemo, useState, useTransition } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { CancelTxConfirmPopup } from '../CancelTxConfirmPopup';

const ClearPendingAlertDetail = ({
  data,
  onClearPending,
}: {
  data: TransactionGroup[];
  onClearPending?: (data: TransactionGroup[]) => void;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  const chainId = data?.[0]?.chainId;
  const chain = useFindChain({ id: chainId });
  const chainName = chain?.name || 'Unknown';
  const nonces = data.map(item => `#${item.nonce}`).join('、');

  if (!chain) {
    return null;
  }

  return (
    <View style={styles.card}>
      <RcIconWarningCC
        color={colors2024['orange-default']}
        width={18}
        height={18}
      />
      <Text style={styles.cardText}>
        <Trans
          i18nKey="page.transactions.TransactionAlert.clearPendingText"
          values={{
            nonces: nonces,
            chainName: chainName,
          }}
          nonces={nonces}
          chainName={chainName}>
          Transaction ({chainName} {nonces}) has been pending for over 3
          minutes. You can{' '}
          <Text
            style={styles.linkText}
            onPress={() => {
              onClearPending?.(data);
            }}>
            Clear Pending Locally
          </Text>{' '}
          and resubmit the transaction.
        </Trans>
      </Text>
    </View>
  );
};

const SkipNonceAlertDetail = ({
  data,
  onSubmitTx,
}: {
  data: { nonce: number; chainId: number; address: string };
  onSubmitTx?: (item: {
    nonce: number;
    chainId: number;
    address: string;
  }) => void;
}) => {
  const { colors2024, styles } = useTheme2024({ getStyle });

  const chain = useFindChain({ id: data.chainId });
  const nonce = data.nonce;
  const chainName = chain?.name || 'Unknown';

  return (
    <View style={styles.card}>
      <RcIconWarningCC
        color={colors2024['orange-default']}
        width={18}
        height={18}
      />
      <Text style={styles.cardText}>
        <Trans
          i18nKey="page.transactions.TransactionAlert.skipNonceText"
          values={{
            nonce: nonce,
            chainName: chainName || 'Unknown',
          }}
          nonce={nonce}
          chainName={chainName}>
          Nonce #{{ nonce }} skipped on {{ chainName }} chain. This may cause
          pending transactions ahead.{' '}
          <Text
            style={styles.linkText}
            onPress={() => {
              onSubmitTx?.(data);
            }}>
            Submit a tx
          </Text>{' '}
          on chain to resolve
        </Trans>
      </Text>
    </View>
  );
};

export const TransactionAlert = ({
  pendingTxs,
}: {
  pendingTxs?: TransactionGroup[];
}) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const navigation = useRabbyAppNavigation();
  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();
  const { accounts } = useMyAccounts();

  const { data } = useRequest(
    async () => {
      const res = await Promise.all(
        uniqBy(pendingTxs, item => item.address).map(item =>
          apisTransactionHistory.getSkipedTxs(item.address),
        ),
      );
      return flattenDeep(res.map(item => Object.values(item)));
    },
    {
      refreshDeps: [pendingTxs?.length],
    },
  );

  const [confirmState, setConfirmState] = useSetState<{
    visible?: boolean;
    groups: TransactionGroup[];
  }>({
    visible: false,
    groups: [],
  });

  const handleOnChainCancel = useMemoizedFn(
    async ({
      chainId,
      nonce,
      address,
    }: {
      chainId: number;
      nonce: number;
      address: string;
    }) => {
      const chain = findChain({
        id: chainId,
      });
      if (!chain) {
        throw new Error('chainServerId not found');
      }
      let account: KeyringAccountWithAlias | undefined;
      const canUseAccountList = accounts.filter(acc => {
        return (
          isSameAddress(acc.address, address) &&
          acc.type !== KEYRING_TYPE.WatchAddressKeyring
        );
      });

      if (!account) {
        account = findAccountByPriority(canUseAccountList);
      }
      if (!account) {
        throw Error('No account find');
      }

      await switchSceneSigningAccount('MultiHistory', account);

      const gasLevels: GasLevel[] = chain?.isTestnet
        ? await apiCustomTestnet.getCustomTestnetGasMarket({
            chainId: chainId,
          })
        : await apiProvider.gasMarketV2(
            {
              chainId: chain.serverId,
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
                from: address,
                to: address,
                gasPrice: intToHex(maxGasMarketPrice),
                value: '0x0',
                chainId: chainId,
                nonce: intToHex(nonce),
                isCancel: true,
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
      resetNavigationTo(navigation, 'Home');
    },
  );

  const handleClearPending = useMemoizedFn((groups: TransactionGroup[]) => {
    uniqBy(groups, item => `${item.address}-${item.chainId}`).forEach(item => {
      apisTransactionHistory.removeLocalPendingTx({
        address: item.address,
        chainId: item.chainId,
      });
    });
    toast.success(t('page.transactions.TransactionAlert.clearPendingSuccess'));

    resetNavigationTo(navigation, 'Home');
  });

  const [now, setNow] = useState(dayjs());

  useInterval(() => {
    setNow(dayjs());
  }, 1000 * 60);

  const needClearPendingTxs = useMemo(() => {
    const list = Object.entries(
      groupBy(pendingTxs, item => `${item.address}-${item.chainId}`),
    )
      .map(([key, txGroups]) => {
        const [address, chainId] = key.split('-');
        return {
          address,
          chain: chainId,
          data: sortBy(txGroups, item => +item.nonce),
          needClear: txGroups.some(item => {
            return dayjs(item.createdAt).isBefore(now.subtract(3, 'minute'));
          }),
        };
      })
      .filter(item => item.needClear);

    return Object.values(groupBy(list, item => item.chain)).map(item => {
      const txGroups = flatten(item.map(i => i.data));
      return {
        ...item[0],
        data: txGroups,
      };
    });
  }, [pendingTxs, now]);

  if (!data?.length && !needClearPendingTxs?.length) {
    return null;
  }

  return (
    <View style={styles.list}>
      {data?.map(item => {
        return (
          <SkipNonceAlertDetail
            key={`${item.address}-${item.nonce}`}
            data={item}
            onSubmitTx={handleOnChainCancel}
          />
        );
      })}

      {needClearPendingTxs?.map(item => {
        return (
          <ClearPendingAlertDetail
            key={item.chain}
            data={item.data}
            onClearPending={groups => {
              setConfirmState({
                groups,
                visible: true,
              });
            }}
          />
        );
      })}

      <CancelTxConfirmPopup
        visible={confirmState.visible}
        onClose={() => {
          setConfirmState({
            visible: false,
            groups: [],
          });
        }}
        onConfirm={() => {
          if (!confirmState.groups?.length) {
            return;
          }
          handleClearPending(confirmState.groups);
          setConfirmState({
            visible: false,
            groups: [],
          });
        }}
      />
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => {
  return {
    list: {
      paddingHorizontal: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    },
    card: {
      padding: 8,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      borderRadius: 8,
      backgroundColor: colors2024['orange-light-1'],
    },
    cardText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['orange-default'],
      flex: 1,
    },
    link: {
      padding: 0,
    },
    linkText: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      color: colors2024['brand-default'],
      textDecorationLine: 'underline',
    },
  };
});
