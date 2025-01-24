/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { unionBy, orderBy, isUndefined, maxBy } from 'lodash';
import { useInterval, useMemoizedFn, useRequest } from 'ahooks';
import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcIconRightCC } from '@/assets/icons/common';
import { toast } from '@/components2024/Toast';
import { createGetStyles2024 } from '@/utils/styles';
import {
  NFTItem,
  TokenItem,
  GasLevel,
} from '@rabby-wallet/rabby-api/dist/types';
import {
  formatPrice,
  formatTokenAmount,
  intToHex,
  numberWithCommasIsLtOne,
} from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { StackActions, useRoute } from '@react-navigation/native';
import { useSortAddressList } from '../Address/useSortAddressList';
import { navigate, naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import {
  HistoryItemCateType,
  HistoryItemIcon,
} from './components/HistoryItemIcon';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { strings } from '@/utils/i18n';
import { Button } from '@/components2024/Button';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AssetAvatar } from '@/components';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { useFindChain } from '@/hooks/useFindChain';
import { TransactionPendingDetail } from '../TransactionRecord/components/TransactionPendingDetail';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { CANCEL_TX_TYPE, INTERNAL_REQUEST_SESSION } from '@/constant';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { findAccountByPriority } from '../TransactionRecord/components/TransactionItem2025';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { apiCustomTestnet, apiProvider } from '@/core/apis';
import { sendRequest } from '@/core/apis/sendRequest';
import { resetNavigationTo, useRabbyAppNavigation } from '@/hooks/navigation';
import { AddressItemInDetail, TxStatusItem } from './HistoryDetailScreen';
import { ensureAbstractPortfolioToken } from '../Home/utils/token';
import { transactionHistoryService } from '@/core/services';
import { CHAINS_ENUM } from '@debank/common';
import { findMaxGasTx } from '@/core/utils/tx';
import BigNumber from 'bignumber.js';
import { ApproveToken } from './components/Actions/ApproveToken';
import { ApproveNFT } from './components/Actions/ApproveNFT';
import { ApproveNFTCollection } from './components/Actions/ApproveNFTCollection';
import { RevokeNFT } from './components/Actions/RevokeNFT';
import { RevokeNFTCollection } from './components/Actions/RevokeNFTCollection';
import { RevokeToken } from './components/Actions/RevokeToken';
import { CancelTx } from './components/Actions/CancelTx';
import { DeployContact } from './components/Actions/DeployContract';
import { Swap } from './components/Actions/Swap';
import { Send } from './components/Actions/Send';
import { useTranslation } from 'react-i18next';
import { UnknownAction } from './components/Actions/UnknownAction';
import { GetNestedScreenNavigationProps } from '@/navigation-type';

function HistoryLocalDetailScreen(): JSX.Element {
  const route =
    useRoute<
      GetNestedScreenNavigationProps<
        'TransactionNavigatorParamList',
        'HistoryLocalDetail'
      >['route']
    >();
  const {
    data: _data,
    canCancel,
    isForMultipleAdderss,
    title,
  } = route.params || {};
  const [data, setData] = React.useState<TransactionGroup>(_data);
  const isPending = useMemo(() => data.isPending, [data]);
  const isFailed = useMemo(() => data.isFailed, [data]);
  console.debug('HistoryLocalDetailScreen isPending', isPending);
  const { switchAccount } = useCurrentAccount();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();
  const { t } = useTranslation();

  const fetchRefreshData = useCallback(() => {
    if (!isPending) {
      // has done
      return;
    }

    const address = data.address;
    const chainId = data.chainId;
    const nonce = data.nonce;
    const groups = transactionHistoryService.getPendingTxsByNonce(
      address,
      chainId,
      nonce,
    );

    console.debug('fetchRefreshData groups', groups);
    if (groups.length?.[0]) {
      setData(groups[0]);
    }
  }, [isPending, data]);

  useInterval(fetchRefreshData, 5000);

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.headerTitleStyle}>
        {title || strings('page.transactions.itemTitle.Default')}
      </HeaderTitleText2024>
    );
  }, [title, styles.headerTitleStyle]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  const chainItem = useFindChain({
    id: data.chainId,
  });

  const { accounts } = useAccounts({
    disableAutoFetch: true,
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

  const navigation = useRabbyAppNavigation();
  const { switchSceneSigningAccount } = useSwitchSceneCurrentAccount();
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
      : await apiProvider.gasMarketV2({
          chain: chainItem!,
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
    resetNavigationTo(navigation, 'Home');
  };

  const handleTxSpeedUp = useMemoizedFn(async () => {
    if (!canCancel) {
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
      : await apiProvider.gasMarketV2({
          chain: chainItem!,
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
    resetNavigationTo(navigation, 'Home');
  });

  const handleTxCancel = useMemoizedFn(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.CANCEL_TX_POPUP,
      tx: data.maxGasTx,
      onCancelTx: (mode: CANCEL_TX_TYPE) => {
        if (mode === CANCEL_TX_TYPE.QUICK_CANCEL) {
          handleQuickCancel();
        }
        if (mode === CANCEL_TX_TYPE.ON_CHAIN_CANCEL) {
          handleOnChainCancel();
        }
        removeGlobalBottomSheetModal2024(id);
      },
    });
  });

  return (
    <NormalScreenContainer2024
      type="bg2"
      style={{
        // position: 'relative',
        paddingBottom: bottom,
        paddingTop: 24,
        paddingHorizontal: 16,
      }}>
      {data.maxGasTx.action?.actionData?.approveToken ? (
        <ApproveToken data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.approveNFT ? (
        <ApproveNFT data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.approveNFTCollection ? (
        <ApproveNFTCollection
          data={data}
          isSingleAddress={!isForMultipleAdderss}
        />
      ) : data.maxGasTx.action?.actionData?.revokeNFT ? (
        <RevokeNFT data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.revokeNFTCollection ? (
        <RevokeNFTCollection
          data={data}
          isSingleAddress={!isForMultipleAdderss}
        />
      ) : data.maxGasTx.action?.actionData?.revokeToken ? (
        <RevokeToken data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.cancelTx ? (
        <CancelTx data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.deployContract ? (
        <DeployContact data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.swap ? (
        <Swap data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : data.maxGasTx.action?.actionData?.send ? (
        <Send data={data} isSingleAddress={!isForMultipleAdderss} />
      ) : (
        <UnknownAction data={data} isSingleAddress={!isForMultipleAdderss} />
      )}
      {isPending ? (
        <View style={styles.buttonContainer}>
          <View style={{ flex: 1 }}>
            <Button
              titleStyle={[styles.ghostTitle]}
              buttonStyle={[styles.ghostButton]}
              onPress={handleTxCancel}
              title={strings('page.transactions.detail.Cancel')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              titleStyle={[styles.primaryTitle]}
              buttonStyle={[styles.primaryButton]}
              onPress={handleTxSpeedUp}
              title={strings('page.transactions.detail.SpeedUp')}
            />
          </View>
        </View>
      ) : null}
    </NormalScreenContainer2024>
  );
}

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  detailContainer: {
    // flex: 1,
    width: '100%',
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
  },
  ghostButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['neutral-info'],
  },
  primaryButton: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderColor: colors2024['brand-default'],
  },
  primaryTitle: {
    color: colors2024['brand-default'],
  },
  ghostTitle: {
    color: colors2024['neutral-title-1'],
  },
  iconSwitchArrow: {
    backgroundColor: colors2024['neutral-bg-2'],
    borderRadius: 200,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -22,
    marginTop: -22,
  },
  tokenAmountTextList: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
  },
  colomnBox: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  isSendTextColor: {
    color: colors2024['neutral-title-1'],
  },
  isFailBox: {
    opacity: 0.3,
  },
  image: {
    width: 46,
    height: 46,
  },
  fromTokenBox: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
    gap: 10,
  },
  toTokenBox: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-1'],
    flex: 1,
    height: 110,
  },
  singleBox: {
    width: '100%',
    height: 92,
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'space-between',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
  },
  tokenAmountText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700',
  },
  mutliBox: {
    width: '100%',
    backgroundColor: colors2024['neutral-bg-1'],
    justifyContent: 'center',
    alignContent: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 16,
    // flexDirection: 'row',
    gap: 12,
  },
  doubleBox: {
    justifyContent: 'center',
    alignContent: 'center',
    flexDirection: 'row',
    height: 110,
    gap: 10,
    position: 'relative',
  },

  buttonContainer: {
    position: 'absolute',
    flexDirection: 'row',
    height: 60,
    bottom: 40,
    width: '100%',
    gap: 16,
    left: 16,
  },
  itemAliaName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitleText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '500',
  },
  itemAddressText: {
    color: colors2024['neutral-foot'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '400',
  },
  itemContentText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  headerTitleStyle: {
    color: colors2024['neutral-title-1'],
    fontWeight: '800',
    fontSize: 20,
    fontFamily: 'SF Pro Rounded',
    lineHeight: 24,
  },

  statuItemText: {
    color: colors2024['green-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 4,
  },

  headerItem: {},
}));

export { HistoryLocalDetailScreen };
