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
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { unionBy, orderBy, isUndefined, maxBy } from 'lodash';
import { useMemoizedFn, useRequest } from 'ahooks';
import PQueue from 'p-queue';
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
import { HistoryDisplayItem } from './MultiAddressHistory';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import { RcIconExternalLinkCC, RcIconRightCC } from '@/assets/icons/common';
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
import { navigate } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { getChain } from '@/utils/chain';
import { openTxExternalUrl } from '@/utils/transaction';
import { HistoryItemCateType } from './components/HistoryItemIcon';
import { HistoryTokenList } from './components/HistoryTokenList';
import { getApproveTokeName, getHistoryItemType } from './components/utils';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import HeaderTitleText2024 from '@/components2024/ScreenHeader/HeaderTitleText';
import { strings } from '@/utils/i18n';
import { Button } from '@/components2024/Button';
import { HistoryBottomBtn } from './components/HistoryBottomBtn';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { AssetAvatar } from '@/components';
import { format } from 'path';
import { getERC20Allowance } from '@/core/apis/provider';
import BigNumber from 'bignumber.js';

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
            {strings('page.transactions.detail.Pending')}
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
            {strings('page.transactions.detail.Succeeded')}
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
          {strings('page.transactions.detail.Failed')}
        </Text>
      )}
    </View>
  );
};

export const AddressItemInDetail = ({
  address,
  accounts,
  switchAccount,
}: {
  address: string;
  switchAccount: (account: KeyringAccountWithAlias) => void;
  accounts: KeyringAccountWithAlias[];
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle });

  const isInAccounts = useMemo(() => {
    const idx = accounts.findIndex(account =>
      isSameAddress(account.address, address),
    );
    return idx > -1;
  }, [accounts, address]);

  const handleGoAddressDetail = useCallback(() => {
    const idx = accounts.findIndex(account =>
      isSameAddress(account.address, address),
    );

    if (idx > -1) {
      switchAccount(accounts[idx]);
      navigate(RootNames.SingleAddressStack, {
        screen: RootNames.SingleAddressHome,
      });
    } else {
      // popup
      console.debug('itemAliaName press open popup', address);
    }
  }, [accounts, address, switchAccount]);

  return (
    <View>
      {getAlianName(address) ? (
        <View style={{ alignItems: 'flex-end' }}>
          <TouchableOpacity
            disabled={!isInAccounts}
            style={styles.itemAliaName}
            onPress={handleGoAddressDetail}>
            <Text style={styles.itemContentText}>
              {getAlianName(address) || ellipsisAddress(address)}
            </Text>
            {isInAccounts && (
              <RcIconRightCC
                width={14}
                height={14}
                color={colors2024['neutral-foot']}
              />
            )}
          </TouchableOpacity>
          <Text style={styles.itemAddressText}>{ellipsisAddress(address)}</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.itemAliaName}
          disabled={!isInAccounts}
          onPress={handleGoAddressDetail}>
          <Text style={styles.itemContentText}>{ellipsisAddress(address)}</Text>
          {isInAccounts && (
            <RcIconRightCC
              width={14}
              height={14}
              color={colors2024['neutral-foot']}
            />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

function HistoryDetailScreen(): JSX.Element {
  const route = useRoute();
  const { data, isForMultipleAdderss, title } = (route.params || {}) as {
    data: HistoryDisplayItem;
    isForMultipleAdderss?: boolean;
    title?: string;
  };
  console.debug(
    'HistoryDetailScreen',
    data.projectDict[data.project_id!],
    data.projectDict.length,
    data.tx,
    data.other_addr,
    isForMultipleAdderss,
  );

  const [currentApprove, setCurrentApprove] = useState(0);
  const [noRemainValue, setNoRemainValue] = useState(false);
  const status = useMemo(() => data.tx?.status || 0, [data]);
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

  const { chainItem, touchable } = useMemo(() => {
    const info =
      typeof data.chain === 'string' ? getChain(data.chain) : data.chain;

    return { chainItem: info, touchable: !!info?.scanLink };
  }, [data.chain]);
  const { accounts } = useAccounts({
    disableAutoFetch: true,
  });
  const list = useSortAddressList(accounts);
  const unionAccounts = useMemo(() => {
    return unionBy(list, account => account.address.toLowerCase());
  }, [list]);

  const formatType: HistoryItemCateType = useMemo(() => {
    return getHistoryItemType(data);
  }, [data]);

  const { formatToken, isNft } = useMemo(() => {
    const cate = formatType;
    const isDoubleToken =
      cate === HistoryItemCateType.Swap || cate === HistoryItemCateType.Bridge;

    const { tokenDict } = data;
    if (isDoubleToken) {
      const send = data.sends[0];
      const receive = data.receives[0];

      return {
        formatToken: [tokenDict[send.token_id], tokenDict[receive.token_id]],
        isNft: false,
      };
    } else {
      const isApprove = cate === HistoryItemCateType.Approve;
      const commonItem =
        cate === HistoryItemCateType.Send ? data.sends[0] : data.receives[0];

      const tokenId = isApprove
        ? (data.token_approve?.token_id as string)
        : commonItem?.token_id;
      const tokenIsNft = tokenId?.length === 32;
      const tokenUUID = `${data.chain}_token:${tokenId}`;
      const token = tokenDict[tokenId] || tokenDict[tokenUUID];

      return {
        formatToken: {
          ...token,
          amount: commonItem?.amount || data.token_approve?.value || 0,
        },
        isNft: tokenIsNft,
      };
    }
  }, [data, formatType]);

  const fromAddr = data.tx?.from_addr;
  const toAddr =
    formatType === HistoryItemCateType.Recieve
      ? data.address
      : formatType === HistoryItemCateType.Send
      ? data.sends[0].to_addr
      : data.tx?.to_addr;
  const usdGasFee = data.tx?.usd_gas_fee;

  const formatProject = useMemo(() => {
    const projectDict = data.projectDict;

    if (data.project_id) {
      return projectDict[data.project_id];
    }
  }, [data]);

  const fetchApproveAllowance = useCallback(async () => {
    const tokenId = data.token_approve?.token_id || '';
    const tokenUUID = `${data.chain}_token:${tokenId}`;
    const singeToken = data.tokenDict[tokenId] || data.tokenDict[tokenUUID];

    const allowance = await getERC20Allowance(
      data.chain,
      singeToken.id,
      data.token_approve?.spender!,
    );

    const amount = new BigNumber(allowance)
      .div(10 ** singeToken.decimals)
      .toNumber();

    setNoRemainValue(!amount);
    setCurrentApprove(amount);
  }, [data]);

  useEffect(() => {
    if (formatType === HistoryItemCateType.Approve) {
      fetchApproveAllowance();
    }
  }, [fetchApproveAllowance, formatType]);

  const onOpenTxId = useCallback(() => {
    const info =
      typeof data.chain === 'string' ? getChain(data.chain) : data.chain;

    if (info?.scanLink) {
      openTxExternalUrl({ chain: info, txHash: data.id });
    } else {
      toast.error('Unknown chain');
    }
  }, [data]);

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
          <View style={{ alignItems: 'flex-end' }}>
            <View
              style={{
                flexDirection: 'row',
                gap: 4,
              }}>
              <AssetAvatar logo={formatProject?.logo_url} size={16} />
              <Text style={[styles.itemContentText]}>
                {formatProject?.name}
              </Text>
            </View>
            <Text style={styles.itemAddressText}>
              {ellipsisAddress(data.tx?.to_addr || data.other_addr || '')}
            </Text>
          </View>
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
    ],
  );

  return (
    <NormalScreenContainer2024
      type="bg2"
      style={{
        paddingBottom: bottom,
        paddingTop: 24,
        paddingHorizontal: 16,
      }}>
      <HistoryTokenList
        data={data}
        isForMultipleAdderss={isForMultipleAdderss}
        chain={data.chain}
        receives={data.receives}
        sends={data.sends}
        approve={data.token_approve}
        type={formatType}
        token={formatToken}
        status={status}
        tokenDict={data.tokenDict}
      />
      <View style={styles.detailContainer}>
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>Date</Text>
          <View>
            <Text style={styles.itemContentText}>
              {formatIntlTimestamp(data?.time_at * 1000)}
            </Text>
          </View>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.itemTitleText}>
            {strings('page.transactions.detail.Status')}
          </Text>
          <View>
            <TxStatusItem status={status} withText={true} />
          </View>
        </View>
        {isApproveOrRevoke &&
          ProjecRenderItem(
            formatType === HistoryItemCateType.Approve
              ? strings('page.transactions.detail.ApproveTo')
              : strings('page.transactions.detail.RevokeFrom'),
          )}
        {formatType === HistoryItemCateType.Approve && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {strings('page.transactions.detail.ApproveToken')}
            </Text>
            <Text style={styles.itemContentText}>
              {data.token_approve?.value! < 1e9
                ? data.token_approve?.value.toFixed(4)
                : strings('page.transactions.detail.Unlimited')}{' '}
              {getApproveTokeName(data)}
            </Text>
          </View>
        )}
        {Boolean(fromAddr) && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {strings('page.transactions.detail.From')}
            </Text>
            <AddressItemInDetail
              address={fromAddr!}
              accounts={unionAccounts}
              switchAccount={switchAccount}
            />
          </View>
        )}
        {(formatType === HistoryItemCateType.Send ||
          formatType === HistoryItemCateType.Recieve) &&
          Boolean(toAddr) && (
            <View style={styles.detailItem}>
              <Text style={styles.itemTitleText}>
                {formatType === HistoryItemCateType.Recieve
                  ? strings('page.transactions.detail.RecipientAddress')
                  : strings('page.transactions.detail.To')}
              </Text>
              <AddressItemInDetail
                address={toAddr!}
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
        {Boolean(usdGasFee) && status === 1 && (
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>
              {strings('page.transactions.detail.GasFee')}
            </Text>
            <Text style={styles.itemContentText}>
              {numberWithCommasIsLtOne(data.tx?.eth_gas_fee, 2)}{' '}
              {chainItem?.nativeTokenSymbol} ($
              {numberWithCommasIsLtOne(data.tx?.usd_gas_fee ?? 0, 2)})
            </Text>
            {/* <Text style={[styles.itemContentText]}>{`-${formatPrice(
              usdGasFee!,
            )} USD`}</Text> */}
          </View>
        )}
        {!isApproveOrRevoke &&
          ProjecRenderItem(
            strings('page.transactions.detail.InteractedContract'),
          )}
        {
          <View style={styles.detailItem}>
            <Text style={styles.itemTitleText}>Hash</Text>
            <TouchableOpacity
              disabled={!touchable}
              onPress={onOpenTxId}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={[styles.itemContentText]}>
                {ellipsisAddress(data.id)}
              </Text>
              <RcIconExternalLinkCC
                width={14}
                height={14}
                color={colors2024['neutral-foot']}
              />
            </TouchableOpacity>
          </View>
        }
      </View>
      <HistoryBottomBtn
        noRemainValue={noRemainValue}
        currentApprove={currentApprove}
        approve={data.token_approve}
        receives={data.receives}
        sends={data.sends}
        type={formatType}
        chain={data.chain}
        status={status || 0}
        data={data}
        tokenDict={data.tokenDict}
      />
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

export { HistoryDetailScreen };
