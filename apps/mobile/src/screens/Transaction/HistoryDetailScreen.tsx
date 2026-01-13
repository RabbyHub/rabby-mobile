/* eslint-disable react-native/no-inline-styles */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme2024 } from '@/hooks/theme';
import RcIconSuccess from '@/assets2024/icons/history/IconSuccess.svg';
import RcIconPending from '@/assets2024/icons/history/IconPending.svg';
import RcIconScamTips from '@/assets2024/icons/history/IconScamTips.svg';
import RcIconRightCC from '@/assets2024/icons/history/IconRightArrowCC.svg';
import RcIconFail from '@/assets2024/icons/history/IconFail.svg';
import { KeyringAccountWithAlias, useAccounts } from '@/hooks/account';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';

import RcIconJumpCC from '@/assets2024/icons/history/IconJumpCC.svg';
import { toast } from '@/components2024/Toast';
import { createGetStyles2024 } from '@/utils/styles';
import { formatAmount } from '@/utils/number';
import { formatIntlTimestamp } from '@/utils/time';
import { useRoute } from '@react-navigation/native';
import { getAliasName } from '@/core/apis/contact';
import { ellipsisAddress } from '@/utils/address';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { HistoryTokenList } from './components/HistoryTokenList';
import { getApproveTokeName } from './components/utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { HistoryBottomBtn } from './components/HistoryBottomBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AssetAvatar } from '@/components';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useSafeAndroidBottomSizes } from '@/hooks/useAppLayout';
import { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { ellipsisOverflowedText } from '@/utils/text';
import { useTranslation } from 'react-i18next';
import { RevokeTokenBtn } from './components/Actions/components/RevokeTokenBtn';
import { KEYRING_TYPE } from '@rabby-wallet/keyring-utils';
import { HistoryItemCateType } from './components/type';
import { findAccountByPriority } from '@/utils/account';
import { useGetCexList } from './hook';
import FastImage from 'react-native-fast-image';
import { useAccountSelectModalCtx } from '@/components/AccountSelectModalTx/hooks';
import { apisSingleHome } from '../Home/hooks/singleHome';

export const TxStatusItem = ({
  status,
  withText,
  isPending,
  showSuccess,
}: {
  showSuccess?: boolean;
  isPending?: boolean;
  status: number;
  withText?: boolean;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const spinValue = useRef(new Animated.Value(0)).current;
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);

  if (isPending) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Animated.View
          style={{
            transform: [{ rotate: spin }],
          }}>
          <RcIconPending width={18} height={18} />
        </Animated.View>
        {withText && (
          <Text
            style={[
              styles.statuItemText,
              { color: colors2024['orange-default'] },
            ]}>
            {t('page.transactions.detail.Pending')}
          </Text>
        )}
      </View>
    );
  }

  return status === 1 ? (
    !withText && !showSuccess ? null : (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <RcIconSuccess width={18} height={18} />
        {withText && (
          <Text style={styles.statuItemText}>
            {t('page.transactions.detail.Succeeded')}
          </Text>
        )}
      </View>
    )
  ) : (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <RcIconFail width={18} height={18} />
      {withText && (
        <Text
          style={[styles.statuItemText, { color: colors2024['red-default'] }]}>
          {t('page.transactions.detail.Failed')}
        </Text>
      )}
    </View>
  );
};

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

  const disableNavigate = useMemo(() => {
    if (propdisableNavigate) {
      return true;
    }

    return !accounts.find(account => isSameAddress(account.address, address));
  }, [propdisableNavigate, accounts, address]);
  const { getCexInfoByAddress } = useGetCexList();
  const cexInfo = useMemo(() => {
    return getCexInfoByAddress(address);
  }, [address, getCexInfoByAddress]);

  const accountSelectCtx = useAccountSelectModalCtx();

  const handleGoAddressDetail = useCallback(() => {
    const idx = accounts.findIndex(account =>
      isSameAddress(account.address, address),
    );

    if (idx > -1) {
      if (accountSelectCtx.isUnderContext) accountSelectCtx.fnCloseModal();
      apisSingleHome.navigateToSingleHome(accounts[idx]);
    } else {
      // popup
      console.debug('itemAliaName press open popup', address);
    }
  }, [accounts, address, accountSelectCtx]);

  return (
    <View>
      <TouchableOpacity
        disabled={disableNavigate}
        style={styles.itemAliaName}
        onPress={handleGoAddressDetail}>
        <View style={{ alignItems: 'flex-end', flexDirection: 'column' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {cexInfo?.logo_url && (
              <FastImage
                source={{ uri: cexInfo.logo_url }}
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  marginRight: 4,
                }}
              />
            )}
            <Text style={styles.itemContentText}>
              {getAliasName(address) || ellipsisAddress(address)}
            </Text>
            {!disableNavigate && (
              <RcIconRightCC
                width={12}
                height={12}
                color={colors2024['neutral-foot']}
              />
            )}
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
  const { data, isForMultipleAddress, title } = route.params || {};

  const { t } = useTranslation();
  const status = useMemo(() => data.tx?.status ?? 1, [data]);

  const isScam = data.is_scam || data.isSmallUsdTx;
  const { styles, colors2024, isLight } = useTheme2024({ getStyle });
  const { safeSizes } = useSafeAndroidBottomSizes({
    // containerPb: 12,
    btnContainerBottomOffset: 40,
  });
  const buttonContainerStyle = useMemo(() => {
    return [
      styles.buttonContainerStyle,
      { marginBottom: safeSizes.btnContainerBottomOffset },
    ];
  }, [styles.buttonContainerStyle, safeSizes.btnContainerBottomOffset]);

  const { setNavigationOptions } = useSafeSetNavigationOptions();
  const getHeaderTitle = React.useCallback(() => {
    return (
      <HeaderTitleText2024 style={styles.headerTitleStyle}>
        {title || t('page.transactions.itemTitle.Default')}
      </HeaderTitleText2024>
    );
  }, [title, styles.headerTitleStyle, t]);

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
    formatType === HistoryItemCateType.Buy
      ? data.address
      : formatType === HistoryItemCateType.Send
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

  const ProjecRenderItem = useCallback(
    (titleText: string) => {
      return formatProject ? (
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>{titleText}</Text>
          <TouchableOpacity
            style={{ alignItems: 'flex-end' }}
            onPress={() =>
              onOpenTxId(undefined, data.tx?.to_addr || data.other_addr || '')
            }>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}>
              <AssetAvatar logo={formatProject?.logo_url} size={16} />
              <Text style={[styles.itemContentText]}>
                {formatProject?.name}
              </Text>
              <RcIconJumpCC
                width={14}
                height={14}
                color={colors2024['neutral-foot']}
              />
            </View>
            <Text style={styles.itemAddressText}>
              {ellipsisAddress(data.tx?.to_addr || data.other_addr || '')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null;
    },
    [
      data,
      styles.detailItem,
      formatProject,
      styles.itemAddressText,
      styles.itemContentText,
      styles.itemTitleText,
      colors2024,
      onOpenTxId,
    ],
  );

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

  return (
    <NormalScreenContainer2024
      type={!isLight ? 'bg1' : 'bg2'}
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
      <ScrollView style={[styles.scrollView]}>
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
        />
        <View style={[styles.detailContainer, styles.detailContainerLastOne]}>
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
          {isNft && Boolean(formatToken) && (
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
          )}
          {isApproveOrRevoke &&
            ProjecRenderItem(
              formatType === HistoryItemCateType.Approve
                ? t('page.transactions.detail.ApproveTo')
                : t('page.transactions.detail.RevokeFrom'),
            )}
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
          {Boolean(fromAddr) && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {t('page.transactions.detail.From')}
              </Text>
              <AddressItemInDetail address={fromAddr!} accounts={accounts} />
            </View>
          )}
          {(formatType === HistoryItemCateType.Send ||
            formatType === HistoryItemCateType.GAS_WITHDRAW ||
            formatType === HistoryItemCateType.GAS_RECEIVED ||
            formatType === HistoryItemCateType.GAS_DEPOSIT ||
            formatType === HistoryItemCateType.Recieve) &&
            Boolean(toAddr) && (
              <View style={styles.detailItem}>
                <Text style={styles.itemTitleText}>
                  {formatType === HistoryItemCateType.GAS_RECEIVED ||
                  formatType === HistoryItemCateType.GAS_WITHDRAW ||
                  formatType === HistoryItemCateType.Recieve
                    ? t('page.transactions.detail.RecipientAddress')
                    : t('page.transactions.detail.To')}
                </Text>
                <AddressItemInDetail address={toAddr!} accounts={accounts} />
              </View>
            )}
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
          {!isApproveOrRevoke &&
            ProjecRenderItem(t('page.transactions.detail.InteractedContract'))}
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
        {data.cate_id === 'approve' &&
        data.token_approve &&
        data.token_approve.token ? (
          <RevokeTokenBtn
            style={{
              marginTop: -8,
              marginBottom: 20,
            }}
            token={data.token_approve?.token}
            spender={data.token_approve?.spender}
            account={txAccount}
          />
        ) : null}
      </ScrollView>

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
          buttonContainerStyle={buttonContainerStyle}
          account={txAccount}
        />
      ) : null}
    </NormalScreenContainer2024>
  );
}

const PADDING_HORIZONTAL = 16;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: { height: '100%', paddingTop: 24, paddingBottom: 24 },
  scrollView: {
    // height: '100%',
    paddingHorizontal: PADDING_HORIZONTAL,
    flex: 1,
  },
  detailContainer: {
    width: '100%',
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: !isLight
      ? colors2024['neutral-bg-2']
      : colors2024['neutral-bg-1'],
  },
  detailContainerLastOne: {
    marginBottom: 20,
  },
  buttonContainerStyle: {
    paddingHorizontal: PADDING_HORIZONTAL,
    flexShrink: 0,
  },
  itemAliaName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    // gap: 4,
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
}));

export { HistoryDetailScreen };
