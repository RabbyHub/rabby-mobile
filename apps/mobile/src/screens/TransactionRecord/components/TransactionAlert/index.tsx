import { RcIconWarningCC } from '@/assets2024/icons/common';
import { Chain } from '@/constant/chains';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import { useFindChain } from '@/hooks/useFindChain';
import { createGetStyles2024 } from '@/utils/styles';
import { useInterval, useMemoizedFn, useRequest, useSetState } from 'ahooks';
import dayjs from 'dayjs';
import { flatten, flattenDeep, groupBy, maxBy, sortBy, uniqBy } from 'lodash';
import { useMemo, useState } from 'react';
import { Trans } from 'react-i18next';
import { Text, View } from 'react-native';
import { CancelTxConfirmPopup } from '../CancelTxConfirmPopup';
import { toast } from '@/components2024/Toast';
import { apisTransactionHistory } from '@/core/apis/transactionHistory';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '@/utils/account';
import { GasLevel } from '@rabby-wallet/rabby-api/dist/types';
import { findChain } from '@/utils/chain';
import { apiCustomTestnet, apiProvider } from '@/core/apis';
import { sendRequest } from '@/core/apis/sendRequest';
import { intToHex } from '@/utils/number';
import { INTERNAL_REQUEST_SESSION } from '@/constant';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';

const ClearPendingAlertDetail = ({
  data,
  onClearPending,
}: {
  data: TransactionGroup[];
  onClearPending?: (chainId: number) => void;
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
              onClearPending?.(chainId);
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
  const { colors2024, styles } = useTheme2024({ getStyle });
  const navigation = useRabbyAppNavigation();
  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();
  const { accounts } = useMyAccounts();
  const activeAccounts = useMemo(() => {
    if (!pendingTxs?.length) {
      return [];
    }
    return uniqBy(
      accounts.filter(item =>
        pendingTxs.find(txGroup =>
          isSameAddress(txGroup.address, item.address),
        ),
      ),
      item => item.address,
    );
  }, [accounts, pendingTxs]);

  const { data } = useRequest(
    async () => {
      const res = await Promise.all(
        activeAccounts.map(account =>
          apisTransactionHistory.getSkipedTxs(account.address),
        ),
      );
      return flattenDeep(res.map(item => Object.values(item)));
    },
    {
      refreshDeps: [activeAccounts, pendingTxs],
      onError: console.error,
      onSuccess: console.log,
    },
  );

  const [confirmState, setConfirmState] = useSetState<{
    visible?: boolean;
    chainId?: number | null;
  }>({
    visible: false,
    chainId: null,
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
        : await apiProvider.gasMarketV2({
            chainId: chain.serverId,
          });
      const maxGasMarketPrice = maxBy(gasLevels, level => level.price)!.price;
      try {
        await sendRequest(
          {
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
          INTERNAL_REQUEST_SESSION,
        );
      } catch (error) {
        console.error(error);
      } finally {
        await switchSceneSigningAccount('MultiHistory', null);
      }
      resetNavigationTo(navigation, 'Home');
    },
  );

  const handleClearPending = useMemoizedFn(async (chainId: number) => {
    // clearAddressPendingTransactions(account!.address, chain.id);
    await Promise.all(
      activeAccounts.map(account => {
        return apisTransactionHistory.removeLocalPendingTx({
          address: account.address,
          chainId,
        });
      }),
    );
    toast.success('Clear pending transactions success');
    // onClearPending?.();
    resetNavigationTo(navigation, 'Home');
  });

  const [now, setNow] = useState(dayjs());

  useInterval(() => {
    setNow(dayjs());
  }, 1000 * 60);

  const needClearPendingTxs = useMemo(() => {
    return Object.entries(groupBy(pendingTxs, item => item.chainId))
      .map(([key, value]) => {
        return {
          chain: key,
          data: sortBy(value, item => +item.nonce),
          needClear: value.some(item => {
            return dayjs(item.createdAt).isBefore(now.subtract(3, 'minute'));
          }),
        };
      })
      .filter(item => item.needClear);
  }, [pendingTxs, now]);

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

      {!data?.length &&
        needClearPendingTxs?.map(item => {
          return (
            <ClearPendingAlertDetail
              key={item.chain}
              data={item.data}
              onClearPending={chainId => {
                setConfirmState({
                  chainId,
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
            chainId: null,
          });
        }}
        onConfirm={() => {
          if (!confirmState.chainId) {
            return;
          }
          handleClearPending(confirmState.chainId);
          setConfirmState({
            visible: false,
            chainId: null,
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
