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
import { maxBy } from 'lodash';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
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

function findAccountByPriority(accounts: KeyringAccountWithAlias[]) {
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
  data,
  canCancel,
  onRefresh,
}: {
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
      <View>
        <View style={styles.body}>
          <TransactionExplain
            isCanceled={isCanceled}
            isFailed={data.isFailed}
            isSubmitFailed={data.isSubmitFailed}
            isWithdrawed={data.isWithdrawed}
            explain={data.originTx?.explain}
          />
          {data?.isPending && (
            <TransactionAction
              canCancel={canCancel}
              onTxCancel={handleTxCancel}
              onTxSpeedUp={handleTxSpeedUp}
            />
          )}
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

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  card: {
    borderRadius: 30,
    backgroundColor: colors2024['neutral-card1'],
    marginBottom: 12,
    paddingBottom: 18,
    paddingLeft: 16,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: colors2024['neutral-line'],
  },
  cardGray: {
    opacity: 0.5,
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
