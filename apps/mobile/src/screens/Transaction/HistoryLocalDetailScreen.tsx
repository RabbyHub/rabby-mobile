/* eslint-disable react-native/no-inline-styles */
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { HistoryList } from './components/HistoryGroupList';
import { openapi } from '@/core/request';
import { unionBy, orderBy, isUndefined, maxBy } from 'lodash';
import { useMemoizedFn, useRequest } from 'ahooks';
import PQueue from 'p-queue';
import RcIconSwitchArrow from '@/assets2024/icons/history/IconSwitchArrow.svg';
import { AppColorsVariants } from '@/constant/theme';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { Empty } from './components/Empty';
import RcIconSuccess from '@/assets2024/icons/history/IconSuccess.svg';
import RcIconPending from '@/assets2024/icons/history/IconPending.svg';
import RcIconFail from '@/assets2024/icons/history/IconFail.svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  KeyringAccountWithAlias,
  useAccounts,
  useCurrentAccount,
  useMyAccounts,
} from '@/hooks/account';
import RcIconSingleArrow from '@/assets2024/icons/history/IconSingleArrow.svg';
import { HistoryDisplayItem } from './MultiAddressHistory';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcIconRightCC } from '@/assets/icons/common';
import { toast } from '@/components2024/Toast';
import { createGetStyles2024 } from '@/utils/styles';
import {
  TxDisplayItem,
  TxHistoryItem,
  NFTItem,
  TokenItem,
  GasLevel,
} from '@rabby-wallet/rabby-api/dist/types';
import { formatPrice, intToHex, numberWithCommasIsLtOne } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { formatIntlTimestamp } from '@/utils/time';
import { useRoute } from '@react-navigation/native';
import { getAlianName } from '@/core/apis/contact';
import { ellipsisAddress } from '@/utils/address';
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
import { HistoryTokenList } from './components/HistoryTokenList';
import { getApproveTokeName, getHistoryItemType } from './components/utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { strings } from '@/utils/i18n';
import { Button } from '@/components2024/Button';
import { HistoryBottomBtn } from './components/HistoryBottomBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AssetAvatar } from '@/components';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { SwapRequireData } from '@rabby-wallet/rabby-action';
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
import { color } from '@rneui/base';

function HistoryLocalDetailScreen(): JSX.Element {
  const route = useRoute();
  const {
    data,
    canCancel,
    isForMultipleAdderss,
    title,
    formatType,
    sendsToken,
    recievesToken,
  } = (route.params || {}) as {
    data: TransactionGroup;
    canCancel?: boolean;
    isForMultipleAdderss?: boolean;
    sendsToken: TokenItem[];
    formatType: HistoryItemCateType;
    recievesToken: TokenItem[];
    title?: string;
  };
  const isPending = useMemo(() => data.isPending, [data]);
  console.debug('HistoryLocalDetailScreen isPending', isPending);
  console.debug('HistoryLocalDetailScreen data', JSON.stringify(data));
  const { switchAccount } = useCurrentAccount();
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { bottom } = useSafeAreaInsets();

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
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  const fromAddr = data.txs?.[0].rawTx?.from as string;
  const toAddr = data.txs?.[0].rawTx?.to as string;

  const onOpenTxId = useCallback(() => {
    const tx = data.maxGasTx.hash;

    const info = chainItem;

    if (info?.scanLink) {
      openTxExternalUrl({ chain: info, txHash: tx });
    } else {
      toast.error('Unknown chain');
    }
  }, [data, chainItem]);

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

  const handlePressToken = useCallback(
    (singeToken: TokenItem | NFTItem, tokenIsNft: boolean) => {
      if (!singeToken) {
        return;
      }

      if (tokenIsNft) {
        naviPush(RootNames.NftDetail, {
          token: { ...singeToken },
          isSingleAddress: !isForMultipleAdderss,
        });
      } else {
        // if (address) {
        //   setTokenDetailAddress(address);
        // }
        // openTokenDetailPopup(token as TokenItem);
        naviPush(RootNames.TokenDetail, {
          token: ensureAbstractPortfolioToken(singeToken as TokenItem),
          // account: address,
          needUseCacheToken: true,
          isSingleAddress: !isForMultipleAdderss,
        });
      }
    },
    [isForMultipleAdderss],
  );

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

  const TokenContainer = useMemo(() => {
    switch (formatType) {
      case HistoryItemCateType.Send:
        const singeToken = sendsToken[0];
        const tokenIsNft = singeToken?.id.length === 32;
        return (
          <TouchableOpacity
            onPress={() => handlePressToken(singeToken, tokenIsNft)}>
            <View style={[styles.singleBox]}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <HistoryItemIcon
                  isInDetail={true}
                  type={HistoryItemCateType.Send}
                  token={singeToken as TokenItem}
                  isNft={tokenIsNft}
                />
                <View style={[styles.colomnBox]}>
                  <Text
                    style={[styles.tokenAmountText, styles.isSendTextColor]}>
                    {'-'}{' '}
                    {tokenIsNft
                      ? 1
                      : numberWithCommasIsLtOne(singeToken?.amount)}{' '}
                    {tokenIsNft
                      ? strings('page.nft.title')
                      : getTokenSymbol(singeToken as TokenItem)}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <RcIconSingleArrow
                  width={32}
                  height={32}
                  color={colors2024['neutral-bg-2']}
                />
              </View>
            </View>
          </TouchableOpacity>
        );
      case HistoryItemCateType.Swap:
        const sendToken = sendsToken[0];
        const reciToken = recievesToken[0];

        return (
          <View style={[styles.doubleBox]}>
            <TouchableOpacity
              style={[styles.fromTokenBox]}
              onPress={() => handlePressToken(sendToken, false)}>
              <AssetAvatar
                logo={sendToken?.logo_url}
                size={42}
                chain={sendToken?.chain}
                chainSize={16}
              />
              <View style={[styles.colomnBox]}>
                <Text
                  style={[styles.tokenAmountTextList, styles.isSendTextColor]}>
                  {'-'} {numberWithCommasIsLtOne(sendToken.amount, 2)}{' '}
                  {getTokenSymbol(sendToken as TokenItem)}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toTokenBox]}
              onPress={() => handlePressToken(reciToken, false)}>
              <AssetAvatar
                logo={reciToken?.logo_url}
                size={42}
                chain={reciToken?.chain}
                chainSize={16}
              />
              <View style={[styles.colomnBox]}>
                <Text style={[styles.tokenAmountTextList]}>
                  {'+'} {numberWithCommasIsLtOne(reciToken.amount, 2)}{' '}
                  {getTokenSymbol(reciToken as TokenItem)}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.iconSwitchArrow}>
              <RcIconSwitchArrow />
            </View>
          </View>
        );
      default:
        return null;
    }
  }, [
    formatType,
    sendsToken,
    recievesToken,
    handlePressToken,
    styles.colomnBox,
    styles.doubleBox,
    styles.fromTokenBox,
    styles.iconSwitchArrow,
    styles.isSendTextColor,
    styles.toTokenBox,
    styles.tokenAmountTextList,
    colors2024,
    styles.singleBox,
    styles.tokenAmountText,
  ]);

  return (
    <NormalScreenContainer2024
      type="bg2"
      style={{
        // position: 'relative',
        paddingBottom: bottom,
        paddingTop: 24,
        paddingHorizontal: 16,
      }}>
      {TokenContainer}
      <View style={styles.detailContainer}>
        {!isPending && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>Date</Text>
            <View>
              <Text style={styles.itemContentText}>
                {formatIntlTimestamp(data?.time_at * 1000)}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {strings('page.transactions.detail.Status')}
          </Text>
          <View>
            <TxStatusItem status={1} isPending={isPending} withText={true} />
          </View>
        </View>
        {isPending && <TransactionPendingDetail data={data} />}
        {fromAddr && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {strings('page.transactions.detail.From')}
            </Text>
            <AddressItemInDetail
              address={fromAddr}
              accounts={unionAccounts}
              switchAccount={switchAccount}
            />
          </View>
        )}
        {(formatType === HistoryItemCateType.Send ||
          formatType === HistoryItemCateType.Recieve) &&
          toAddr && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {formatType === HistoryItemCateType.Recieve
                  ? strings('page.transactions.detail.RecipientAddress')
                  : strings('page.transactions.detail.To')}
              </Text>
              <AddressItemInDetail
                address={toAddr}
                accounts={unionAccounts}
                switchAccount={switchAccount}
              />
            </View>
          )}
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {strings('page.transactions.detail.Chain')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <ChainIconImage
              size={16}
              chainEnum={chainItem?.enum}
              isShowRPCStatus={true}
            />
            <Text style={[styles.itemContentText]}>{chainItem?.name}</Text>
          </View>
        </View>

        {
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>Hash</Text>
            <TouchableOpacity
              disabled={!chainItem?.scanLink}
              onPress={onOpenTxId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={[styles.itemContentText]}>{`${strings(
                'page.transactions.detail.ViewOn',
              )} ${chainItem?.name || 'Unknown'}`}</Text>
              <RcIconRightCC
                width={14}
                height={14}
                color={colors2024['neutral-foot']}
              />
            </TouchableOpacity>
          </View>
        }
      </View>
      <View style={styles.buttonContainer}>
        <View style={{ flex: 1 }}>
          <Button
            onPress={handleTxCancel}
            title={strings('page.transactions.detail.Cancel')}
            type="ghost"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            onPress={handleTxSpeedUp}
            title={strings('page.transactions.detail.SpeedUp')}
          />
        </View>
      </View>
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
