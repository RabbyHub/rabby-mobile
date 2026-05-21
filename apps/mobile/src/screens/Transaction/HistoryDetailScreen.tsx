/* eslint-disable react-native/no-inline-styles */
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import RcIconScamTips from '@/assets2024/icons/history/IconScamTips.svg';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import { useTheme2024 } from '@/hooks/theme';
import React, { useCallback, useMemo } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { useAccountSelectModalCtx } from '@/components/AccountSelectModalTx/hooks';
import { ScreenHeaderAccountSwitcher } from '@/components/AccountSwitcher/OnScreenHeader';
import { CopyAddressIcon } from '@/components/AddressViewer/CopyAddress';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { Text } from '@/components/Typography';
import { toast } from '@/components2024/Toast';
import { WalletIcon } from '@/components2024/WalletIcon/WalletIcon';
import { getAliasName } from '@/core/apis/contact';
import { switchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { findAccountByPriority } from '@/utils/account';
import { ellipsisAddress } from '@/utils/address';
import { getChain } from '@/utils/chain';
import { formatAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { ellipsisOverflowedText } from '@/utils/text';
import { formatIntlTimestamp } from '@/utils/time';
import { openTxExternalUrl } from '@/utils/transaction';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import FastImage from 'react-native-fast-image';
import { apisSingleHome } from '../Home/hooks/singleHome';
import { RevokeTokenBtn } from './components/Actions/components/RevokeTokenBtn';
import { HistoryBottomBtn } from './components/HistoryBottomBtn';
import { HistoryTokenList } from './components/HistoryTokenList';
import { TxStatusItem } from './components/TxStatusItem';
import { HistoryItemCateType } from './components/type';
import { getApproveTokeName } from './components/utils';
import { useGetCexList } from './hook';
import { isAddress } from 'viem';
import { getTokenSymbol } from '@/utils/token';
import { ProjectItemInDetail } from './components/ProjectItemInDetail';

export const AddressItemInDetail = ({
  address,
  accounts,
  disableNavigate: propdisableNavigate = false,
}: {
  address: string;
  accounts: KeyringAccountWithAlias[];
  disableNavigate?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const account = useMemo(
    () => accounts.find(item => isSameAddress(item.address, address)),
    [accounts, address],
  );
  const disableNavigate = useMemo(() => {
    if (propdisableNavigate) {
      return true;
    }

    return !account;
  }, [propdisableNavigate, account]);

  const { getCexInfoByAddress } = useGetCexList();
  const cexInfo = useMemo(() => {
    return getCexInfoByAddress(address);
  }, [address, getCexInfoByAddress]);

  const accountSelectCtx = useAccountSelectModalCtx();

  const handleGoAddressDetail = useCallback(() => {
    if (account) {
      if (accountSelectCtx.isUnderContext) {
        accountSelectCtx.fnCloseModal();
      }
      apisSingleHome.navigateToSingleHome(account);
    } else {
      // popup
      console.debug('itemAliaName press open popup', address);
    }
  }, [account, accountSelectCtx, address]);

  return (
    <View>
      <TouchableOpacity
        disabled={disableNavigate}
        style={styles.itemAliaName}
        onPress={handleGoAddressDetail}>
        <View style={{ alignItems: 'flex-end', flexDirection: 'column' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cexInfo?.logo_url ? (
              <FastImage
                source={{ uri: cexInfo.logo_url }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            ) : account ? (
              <WalletIcon
                type={account.type}
                address={account.address}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            ) : null}
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.itemContentText,
                styles.itemContentTextAliasName,
                { marginRight: 4 },
              ]}>
              {getAliasName(address) || ellipsisAddress(address)}
            </Text>
            {!disableNavigate && (
              <RcIconRightCC
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            )}
            {!account ? (
              <CopyAddressIcon
                address={address}
                color={colors2024['neutral-foot']}
              />
            ) : null}
          </View>
          <Text style={styles.itemAddressText}>{address}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

function HistoryDetailScreen(): JSX.Element {
  const route =
    useRoute<
      GetNestedScreenRouteProp<'TransactionNavigatorParamList', 'HistoryDetail'>
    >();
  const {
    data,
    isForMultipleAddress,
    title,
    treatSmallAssetsAsScam = false,
    account,
  } = route.params || {};

  const { t } = useTranslation();
  const status = useMemo(() => data.tx?.status ?? 1, [data]);

  const isScam = data.is_scam;
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const getHeaderTitle = React.useCallback(() => {
    return (
      <ScreenHeaderAccountSwitcher
        forScene="HistoryDetail"
        titleText={
          <Text style={styles.headerTitleStyle} numberOfLines={1}>
            {title || t('page.transactions.itemTitle.Default')}
          </Text>
        }
        disableSwitch={true}
      />
    );
  }, [styles.headerTitleStyle, title, t]);

  React.useEffect(() => {
    setNavigationOptions({
      headerTitle: getHeaderTitle,
    });
  }, [setNavigationOptions, getHeaderTitle]);

  const { chainItem, touchable } = useMemo(() => {
    const info =
      typeof data.chain === 'string' ? getChain(data.chain) : data.chain;

    return { chainItem: info, touchable: !!info?.scanLink };
  }, [data.chain]);
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });

  const formatType: HistoryItemCateType = useMemo(() => {
    if (data.historyType === HistoryItemCateType.Swap) {
      if (
        data.receives?.[0]?.token?.is_core &&
        data.sends?.[0]?.token?.is_core
      ) {
        return HistoryItemCateType.Swap;
      } else {
        return HistoryItemCateType.UnKnown;
      }
    }
    return data.historyType;
  }, [data.historyType, data.receives, data.sends]);

  const { formatToken, isNft } = useMemo(() => {
    const cate = formatType;
    const isDoubleToken =
      cate === HistoryItemCateType.Swap || cate === HistoryItemCateType.Bridge;

    if (isDoubleToken) {
      const send = data.sends[0];
      const receive = data.receives[0];

      return {
        formatToken: [send?.token, receive?.token],
        isNft: false,
      };
    } else {
      const isApprove =
        cate === HistoryItemCateType.Approve ||
        cate === HistoryItemCateType.Revoke;
      const commonItem =
        cate === HistoryItemCateType.Send ||
        cate === HistoryItemCateType.GAS_DEPOSIT
          ? data.sends[0]
          : data.receives[0];

      const tokenId = isApprove
        ? (data.token_approve?.token_id as string)
        : commonItem?.token_id;
      const tokenIsNft = tokenId?.length === 32;
      const token = isApprove ? data.token_approve?.token : commonItem?.token;
      return {
        formatToken: {
          ...token,
          amount: commonItem?.amount || data.token_approve?.value || 0,
        } as TokenItem,
        isNft: tokenIsNft,
      };
    }
  }, [data, formatType]);

  const fromAddr = data.tx?.from_addr;
  const toAddr =
    formatType === HistoryItemCateType.Recieve ||
    formatType === HistoryItemCateType.GAS_WITHDRAW ||
    formatType === HistoryItemCateType.Buy
      ? data.address
      : formatType === HistoryItemCateType.Send ||
        formatType === HistoryItemCateType.GAS_DEPOSIT
      ? data.sends[0].to_addr
      : data.tx?.to_addr;
  const usdGasFee = data.tx?.eth_gas_fee;

  const formatProject = useMemo(() => {
    if (data.project_id) {
      return data.project_item;
    }
  }, [data]);

  const onOpenTxId = useCallback(
    (txHash?: string, address?: string) => {
      const info =
        typeof data.chain === 'string' ? getChain(data.chain) : data.chain;

      if (info?.scanLink) {
        address
          ? openTxExternalUrl({ chain: info, address })
          : openTxExternalUrl({ chain: info, txHash });
      } else {
        toast.error('Unknown chain');
      }
    },
    [data],
  );

  const isApproveOrRevoke = useMemo(() => {
    return (
      formatType === HistoryItemCateType.Approve ||
      formatType === HistoryItemCateType.Revoke
    );
  }, [formatType]);

  const txAccount = useMemo(() => {
    let account: KeyringAccountWithAlias | undefined;
    const canUseAccountList = accounts.filter(acc => {
      return (
        isSameAddress(acc.address, data.address) &&
        acc.type !== KEYRING_TYPE.WatchAddressKeyring
      );
    });

    if (!account) {
      account = findAccountByPriority(canUseAccountList);
    }
    return account;
  }, [accounts, data.address]);

  const currentAccount = useMemo(() => {
    return account && isSameAddress(account.address, data.address)
      ? account
      : accounts.find(item => isSameAddress(item.address, data.address));
  }, [account, accounts, data.address]);

  useFocusEffect(
    useCallback(() => {
      if (currentAccount) {
        switchSceneCurrentAccount('HistoryDetail', currentAccount);
      }
    }, [currentAccount]),
  );

  const contractInfo = useMemo(() => {
    if (data.cate_id === 'send' || data.cate_id === 'receive') {
      const token = [...data.sends, ...data.receives]?.[0]?.token;
      const contractId = (token as any).contract_id || token?.id;
      if (
        token &&
        isAddress(contractId) &&
        isSameAddress(contractId, data.tx?.to_addr || '')
      ) {
        return {
          name: getTokenSymbol(token),
          logo: token.logo_url,
          address: data.tx?.to_addr,
        };
      }
      return null;
    }
    if (data.cate_id === 'approve' && data.token_approve) {
      const token = data.token_approve.token;
      const contractId = (token as any).contract_id || token?.id;
      if (
        token &&
        isAddress(contractId) &&
        isSameAddress(contractId, data.tx?.to_addr || '')
      ) {
        return {
          name: getTokenSymbol(token),
          logo: token.logo_url,
          address: data.tx?.to_addr,
        };
      }
    }
    // check this
    return {
      name: data.project_item?.name || '',
      logo: data.project_item?.logo_url || '',
      address: data.tx?.to_addr || '',
    };
  }, [data]);

  const hasBottomBtn = useMemo(() => {
    return (
      (data.cate_id === 'approve' &&
        data.token_approve &&
        data.token_approve.token) ||
      !(data.cate_id === 'approve' && data.token_approve)
    );
  }, [data.cate_id, data.token_approve]);

  console.log('HistoryDetailScreen render', {
    data,
  });

  return (
    <NormalScreenContainer2024
      type={!isLight ? 'bg1' : 'bg0'}
      style={[styles.container]}>
      {isScam ? (
        <View style={styles.scamContainerWrapper}>
          <View style={styles.scamContainer}>
            <View style={{ padding: 2 }}>
              <RcIconScamTips width={14} height={14} />
            </View>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              <Text style={styles.scamText}>
                {t('page.transactions.scam')}:{' '}
                <Text style={styles.scamTipsText}>
                  {t('page.transactions.scamTips')}
                </Text>
              </Text>
            </View>
          </View>
        </View>
      ) : null}
      <ScrollView
        style={[
          styles.scrollView,
          hasBottomBtn ? null : styles.scrollViewWithoutBottomBtn,
        ]}
        showsVerticalScrollIndicator={false}>
        <HistoryTokenList
          data={data}
          isForMultipleAddress={isForMultipleAddress}
          chain={data.chain}
          receives={data.receives}
          sends={data.sends}
          approve={data.token_approve}
          type={formatType}
          token={formatToken}
          status={status}
          account={txAccount}
          extra={
            [
              HistoryItemCateType.Send,
              HistoryItemCateType.GAS_DEPOSIT,
            ].includes(formatType) && Boolean(toAddr) ? (
              <View style={styles.extraItem}>
                <Text style={styles.itemTitleText}>
                  {t('page.transactions.detail.To')}
                </Text>
                <AddressItemInDetail address={toAddr!} accounts={accounts} />
              </View>
            ) : [
                HistoryItemCateType.Recieve,
                HistoryItemCateType.GAS_WITHDRAW,
                HistoryItemCateType.GAS_RECEIVED,
              ].includes(formatType) && Boolean(fromAddr) ? (
              <View style={styles.extraItem}>
                <Text style={styles.itemTitleText}>
                  {t('page.transactions.detail.From')}
                </Text>
                <AddressItemInDetail address={fromAddr!} accounts={accounts} />
              </View>
            ) : isApproveOrRevoke ? (
              <ProjectItemInDetail
                title={
                  formatType === HistoryItemCateType.Approve
                    ? t('page.transactions.detail.ApproveTo')
                    : t('page.transactions.detail.RevokeFrom')
                }
                style={styles.extraItem}
                name={formatProject?.name || ''}
                logo={formatProject?.logo_url || ''}
                address={data.token_approve?.spender || ''}
                chain={data.chain}
              />
            ) : null
          }
        />
        <View style={[styles.detailContainer, styles.detailContainerLastOne]}>
          <View style={styles.detailContainerHeader}>
            <Text style={styles.detailContainerTitle}>
              {t('page.transactions.detail.TransactionDetails')}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.Date')}
            </Text>
            <View>
              <Text style={styles.itemContentText}>
                {formatIntlTimestamp(data?.time_at * 1000)}
              </Text>
            </View>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.Status')}
            </Text>
            <View>
              <TxStatusItem status={status} withText={true} />
            </View>
          </View>
          {/* {isNft && Boolean(formatToken) && (
            <>
              <View style={styles.detailItem}>
                <Text style={styles.itemTitleText}>
                  {t('page.transactions.detail.Name')}
                </Text>
                <View>
                  <Text style={styles.itemContentText}>
                    {ellipsisOverflowedText(
                      (formatToken as unknown as NFTItem)?.name ||
                        t('global.unknownNFT'),
                      30,
                    )}
                  </Text>
                </View>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.itemTitleText}>
                  {t('page.transactions.detail.Collection')}
                </Text>
                <View>
                  <Text style={styles.itemContentText}>
                    {ellipsisOverflowedText(
                      (formatToken as unknown as NFTItem).contract_name ||
                        (formatToken as unknown as NFTItem)?.collection?.name ||
                        t('global.unknownNFT'),
                      30,
                    )}
                  </Text>
                </View>
              </View>
            </>
          )} */}

          {formatType === HistoryItemCateType.Approve && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.ApproveToken')}
              </Text>
              <Text style={styles.itemContentText}>
                {data.token_approve?.value! < 1e9
                  ? data.token_approve?.value.toFixed(4)
                  : t('page.transactions.detail.Unlimited')}{' '}
                {getApproveTokeName(data)}
              </Text>
            </View>
          )}
          {data.tx?.from_addr ? (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.From')}
              </Text>
              <AddressItemInDetail
                address={data.tx?.from_addr}
                accounts={accounts}
              />
            </View>
          ) : null}

          {contractInfo && data.tx?.name ? (
            <ProjectItemInDetail
              title={t('page.transactions.detail.InteractedContract')}
              name={contractInfo.name}
              logo={contractInfo.logo}
              address={contractInfo.address}
              chain={data.chain}
            />
          ) : data.tx?.to_addr ? (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.To')}
              </Text>
              <AddressItemInDetail
                address={data.tx?.to_addr}
                accounts={accounts}
              />
            </View>
          ) : null}

          {data.tx?.name ? (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.Operation')}
              </Text>

              <Text
                style={[styles.itemContentText, styles.operationText]}
                numberOfLines={1}>
                {data.tx?.name}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {t('page.transactions.detail.Chain')}
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
          {Boolean(usdGasFee) && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.GasFee')}
              </Text>
              <Text style={styles.itemContentText}>
                {formatAmount(data.tx?.eth_gas_fee!)}{' '}
                {chainItem?.nativeTokenSymbol} ($
                {formatAmount(data.tx?.usd_gas_fee ?? 0)})
              </Text>
              {/* <Text style={[styles.itemContentText]}>{`-${formatPrice(
              usdGasFee!,
            )} USD`}</Text> */}
            </View>
          )}

          {data.id && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>Hash</Text>
              <TouchableOpacity
                disabled={!touchable}
                onPress={() => onOpenTxId(data.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.itemContentText]}>
                  {ellipsisAddress(data.id)}
                </Text>
                <RcIconJumpCC
                  width={14}
                  height={14}
                  color={colors2024['neutral-foot']}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {data.cate_id === 'approve' &&
      data.token_approve &&
      data.token_approve.token ? (
        <RevokeTokenBtn
          token={data.token_approve?.token}
          spender={data.token_approve?.spender}
          account={txAccount}
        />
      ) : null}

      {!(data.cate_id === 'approve' && data.token_approve) ? (
        <HistoryBottomBtn
          approve={data.token_approve}
          receives={data.receives}
          sends={data.sends}
          type={formatType}
          chain={data.chain}
          status={status || 0}
          data={data}
          isForMultipleAddress={isForMultipleAddress}
          account={txAccount}
        />
      ) : null}
    </NormalScreenContainer2024>
  );
}

const PADDING_HORIZONTAL = 16;

const getStyle = createGetStyles2024(
  ({ colors2024, isLight, safeAreaInsets }) => ({
    container: { height: '100%', paddingTop: 24 },
    scrollView: {
      // height: '100%',
      paddingHorizontal: PADDING_HORIZONTAL,
      flex: 1,
    },
    scrollViewWithoutBottomBtn: {
      marginBottom: Math.max(safeAreaInsets.bottom, 36),
    },
    detailContainer: {
      width: '100%',
      marginTop: 12,
      borderRadius: 16,
      backgroundColor: !isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
      paddingTop: 12,
      paddingBottom: 4,
    },
    detailContainerHeader: {
      marginBottom: 8,
      paddingHorizontal: 16,
    },
    detailContainerTitle: {
      color: colors2024['neutral-body'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '700',
    },
    detailContainerLastOne: {
      marginBottom: 20,
    },

    itemAliaName: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    extraItem: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: isLight
        ? colors2024['neutral-bg-2']
        : colors2024['neutral-bg-1'],
      borderRadius: 12,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginHorizontal: 12,
      marginBottom: 12,
    },
    detailItem: {
      flexDirection: 'row',
      // gap: 4,
      paddingHorizontal: 16,
      paddingVertical: 12,
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    itemTitleText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      fontSize: 14,
      lineHeight: 18,
      fontWeight: '500',
      maxWidth: '45%',
    },
    itemAddressText: {
      color: colors2024['neutral-secondary'],
      fontFamily: 'SF Pro Rounded',
      textAlign: 'right',
      width: 170,
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
    operationText: {
      textTransform: 'capitalize',
    },
    itemContentTextAliasName: {
      maxWidth: 180,
    },
    headerTitleStyle: {
      color: colors2024['neutral-title-1'],
      fontWeight: '800',
      fontSize: 20,
      fontFamily: 'SF Pro Rounded',
      lineHeight: 24,
    },
    scamContainerWrapper: {
      paddingHorizontal: PADDING_HORIZONTAL,
    },
    scamContainer: {
      borderRadius: 6,
      backgroundColor: colors2024['neutral-bg-5'],
      paddingHorizontal: 16,
      paddingVertical: 6,
      flexDirection: 'row',
      width: '100%',
      gap: 2,
      marginBottom: 12,
    },
    scamText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '700',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-body'],
    },
    scamTipsText: {
      fontFamily: 'SF Pro Rounded',
      fontWeight: '400',
      fontSize: 14,
      lineHeight: 18,
      color: colors2024['neutral-foot'],
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
  }),
);

export { HistoryDetailScreen };
