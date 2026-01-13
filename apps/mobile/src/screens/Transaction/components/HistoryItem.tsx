/* eslint-disable react-native/no-inline-styles */
import { getChain } from '@/utils/chain';
import {
  ProjectItem,
  TokenItem,
  TxDisplayItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { TxChange } from './TokenChange';
import React, { useCallback, useEffect, useMemo } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { getAliasName } from '@/core/apis/contact';
import { ellipsisAddress } from '@/utils/address';
import { ellipsisOverflowedText } from '@/utils/text';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { TxStatusItem } from '../HistoryDetailScreen';
import { useTranslation } from 'react-i18next';
import { CUSTOM_HISTORY_TITLE_TYPE, HistoryItemCateType } from './type';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { HistoryItemTokenArea } from './HistoryItemTokenArea';
import { getTokenSymbol } from '@/utils/token';
import FastImage from 'react-native-fast-image';

type HistoryItemProps = {
  style?: StyleProp<ViewStyle>;
  data: HistoryDisplayItem;
  isForMultipleAddress?: boolean;
  getCexInfoByAddress?: (address: string) => ProjectItem;
  onPress?: (data: HistoryDisplayItem) => void;
};

export type TokenChangeDataItem = {
  amount: number;
  token?: TokenItem;
  token_id: string;
  price?: number;
  type: 'send' | 'receive' | 'approve';
};

export const HistoryItem = React.memo(
  ({
    data,
    style,
    isForMultipleAddress,
    onPress,
    getCexInfoByAddress,
  }: HistoryItemProps) => {
    const { t } = useTranslation();
    const isFailed = data.tx?.status === 0;
    const isShowSuccess = data.isShowSuccess;
    const isScam = data.is_scam || data.isSmallUsdTx;
    const chainItem = getChain(data.chain);
    const { styles, isLight } = useTheme2024({ getStyle });

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

    const tokenApproveData = useMemo(() => {
      const res: TokenChangeDataItem[] = [];

      if (!data.token_approve?.token_id) {
        return res;
      }

      const tokenId = data.token_approve?.token_id || '';
      const token = data.token_approve?.token;
      res.push({
        amount: data.token_approve?.value!,
        token,
        token_id: tokenId,
        type: 'approve',
      });

      return res;
    }, [data]);

    const formatTitle = useMemo(() => {
      if (data.historyCustomType) {
        switch (data.historyCustomType) {
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_SUPPLY:
            return t('page.transactions.itemTitle.LendingSupply');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_WITHDRAW:
            return t('page.transactions.itemTitle.LendingWithdraw');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_BORROW:
            return t('page.transactions.itemTitle.LendingBorrow');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY:
            return t('page.transactions.itemTitle.LendingRepay');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_ON_COLLATERAL:
            return t('page.transactions.itemTitle.LendingOnCollateral');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_OFF_COLLATERAL:
            return t('page.transactions.itemTitle.LendingOffCollateral');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE:
            return t('page.transactions.itemTitle.LendingManageEMode');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_MANAGE_EMODE_DISABLE:
            return t('page.transactions.itemTitle.LendingManageEModeDisable');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_DEBT_SWAP:
            return t('page.transactions.itemTitle.LendingDebtSwap');
          case CUSTOM_HISTORY_TITLE_TYPE.LENDING_REPAY_WITH_COLLATERAL:
            return t('page.transactions.itemTitle.LendingRepayWithCollateral');
        }
      }

      switch (formatType) {
        case HistoryItemCateType.GAS_DEPOSIT:
          return t('page.transactions.itemTitle.DepositedGas');
        case HistoryItemCateType.GAS_RECEIVED:
          return t('page.transactions.itemTitle.ReceivedGas');

        case HistoryItemCateType.GAS_WITHDRAW:
          return t('page.transactions.itemTitle.WithdrawnGas');

        case HistoryItemCateType.Swap:
          return t('page.transactions.itemTitle.Swap');

        case HistoryItemCateType.Send:
          return t('page.transactions.itemTitle.Send');
        case HistoryItemCateType.Recieve:
          return t('page.transactions.itemTitle.Recieve');
        case HistoryItemCateType.Bridge:
          return t('page.transactions.itemTitle.Bridge');

        case HistoryItemCateType.Approve:
          return (
            t('page.transactions.itemTitle.Approve') +
            ' ' +
            ellipsisOverflowedText(getTokenSymbol(tokenApproveData[0].token), 6)
          );
        case HistoryItemCateType.Revoke:
          return t('page.transactions.itemTitle.Revoke', {
            token: ellipsisOverflowedText(
              getTokenSymbol(tokenApproveData[0].token),
              6,
            ),
          });
        case HistoryItemCateType.Contract:
          return t('page.transactions.itemTitle.Contract');
        case HistoryItemCateType.Cancel:
          return t('page.transactions.itemTitle.Cancel');
        case HistoryItemCateType.UnKnown:
          return t('page.transactions.itemTitle.Default');
        case HistoryItemCateType.Buy:
          return t('page.transactions.itemTitle.Buy');
        default:
          return data.tx?.name
            ? ellipsisOverflowedText(data.tx?.name, 15)
            : t('page.transactions.itemTitle.Default');
      }
    }, [formatType, data, t, tokenApproveData]);

    const formatDescribe = useMemo(() => {
      const FromText = t('page.swap.from') + ' ';
      const ToText = t('page.swap.to') + ' ';
      let address: string | React.ReactNode = '';
      const project = data.project_item;
      switch (formatType) {
        case HistoryItemCateType.GAS_RECEIVED:
        case HistoryItemCateType.GAS_WITHDRAW:
          address = FromText + t('page.home.services.gasAccount');
          break;
        case HistoryItemCateType.GAS_DEPOSIT:
          address = ToText + t('page.home.services.gasAccount');
          break;

        case HistoryItemCateType.Send:
        case HistoryItemCateType.Recieve:
          const isSend = formatType === HistoryItemCateType.Send;
          const addr = isSend
            ? data.sends[0].to_addr
            : data.receives[0].from_addr;

          const cexInfo = getCexInfoByAddress?.(addr || '');

          const name = project
            ? project.name
            : getAliasName(addr) || ellipsisAddress(addr);

          if (cexInfo) {
            address = (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.describeText}>{ToText}</Text>
                <FastImage
                  source={{ uri: cexInfo.logo_url }}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    marginHorizontal: 4,
                  }}
                />
                <Text style={styles.describeText}>
                  {getAliasName(addr) || ellipsisAddress(addr)}
                </Text>
              </View>
            );
            break;
          }
          address = (isSend ? ToText : FromText) + name;
          break;

        case HistoryItemCateType.Cancel:
          address = getAliasName(data.address) || ellipsisAddress(data.address);
          break;
        case HistoryItemCateType.Contract:
        case HistoryItemCateType.Revoke:
        case HistoryItemCateType.Approve:
        case HistoryItemCateType.Swap:
        default:
          address = project?.name || ellipsisAddress(data.tx?.to_addr || '');
          break;
      }

      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <ChainIconImage
            size={16}
            chainEnum={chainItem?.enum}
            isShowRPCStatus={true}
          />
          {typeof address === 'string' ? (
            <Text style={styles.describeText}>{address}</Text>
          ) : (
            address
          )}
        </View>
      );
    }, [
      formatType,
      data,
      chainItem,
      t,
      styles.describeText,
      getCexInfoByAddress,
    ]);

    const navigation = useRabbyAppNavigation();
    const handleNavigateDetail = useCallback(() => {
      if (onPress) {
        onPress(data);
        return;
      }
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.HistoryDetail,
        params: {
          isForMultipleAddress,
          data,
          title: formatTitle,
        },
      });
    }, [onPress, navigation, isForMultipleAddress, data, formatTitle]);

    const noNeedTokenChangeType = useMemo(
      () =>
        [
          HistoryItemCateType.Cancel,
          HistoryItemCateType.Approve,
          HistoryItemCateType.Revoke,
        ].includes(formatType),
      [formatType],
    );

    const tokenChangeData = useMemo(() => {
      const receives = data.receives
        .map(item => {
          const tokenId = item?.token_id;
          const token = item?.token || {};
          return {
            amount: item.amount,
            token,
            token_id: tokenId,
            price: item.price as number,
            type: 'receive' as TokenChangeDataItem['type'],
          };
        })
        .sort((a, b) => {
          if (a.token?.is_core === b.token?.is_core) {
            return b.amount * b.price - a.amount * a.price;
          }
          return a.token?.is_core ? -1 : 1;
        });

      const sends = data.sends
        .map(item => {
          const tokenId = item?.token_id;
          const token = item?.token || {};
          return {
            amount: item.amount,
            token,
            token_id: tokenId,
            price: item.price as number,
            type: 'send' as TokenChangeDataItem['type'],
          };
        })
        .sort((a, b) => {
          if (a.token?.is_core === b.token?.is_core) {
            return b.amount * b.price - a.amount * a.price;
          }
          return a.token?.is_core ? 1 : -1;
        });
      return [...receives, ...sends];
    }, [data]);

    return (
      <TouchableOpacity onPress={handleNavigateDetail}>
        <View style={[styles.card, style, isScam ? styles.cardGray : null]}>
          <View style={styles.cardBody}>
            <View
              style={[
                styles.leftContent,
                {
                  width: noNeedTokenChangeType ? '95%' : '50%',
                },
              ]}>
              <HistoryItemTokenArea
                type={formatType as HistoryItemCateType}
                tokenChangeData={tokenChangeData}
                tokenApproveData={tokenApproveData}
              />
              <View style={styles.textBox}>
                <View style={styles.titleBox}>
                  <Text style={styles.titleText} numberOfLines={1}>
                    {formatTitle}
                  </Text>
                  {isScam ? (
                    <View style={styles.scamContainer}>
                      <Text style={styles.scamText}>
                        {t('page.transactions.scam')}
                      </Text>
                    </View>
                  ) : isShowSuccess ? (
                    <TxStatusItem status={1} showSuccess={true} />
                  ) : (
                    <TxStatusItem status={data.tx?.status ?? 1} />
                  )}
                </View>
                {formatDescribe}
              </View>
            </View>
            <TxChange
              tokenChangeData={data.tx?.status === 1 ? tokenChangeData : []}
              style={styles.txChange}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingRight: 16,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 8,
    // borderColor: colors2024['neutral-line'],
    // borderWidth: 1,
  },
  titleBox: {
    marginBottom: 3,
    flexDirection: 'row',
    gap: 6,
  },
  imageBox: {
    width: 46,
    height: 46,
    position: 'relative',
  },
  iconBR: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
  },
  cardGray: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // width: '55%',
  },
  textBox: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  titleText: {
    color: colors2024['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '500',
  },
  describeText: {
    color: colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  },
  cardHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  scamContainer: {
    borderRadius: 2,
    height: 18,
    backgroundColor: colors2024['neutral-bg-5'],
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scamText: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 16,
    color: colors2024['neutral-foot'],
  },
  cardHeaderInner: {
    flexGrow: 1,
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  cardBody: {
    paddingVertical: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardFooter: {
    padding: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gas: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-foot'],
  },
  failed: {
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
  },
  time: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
    color: colors2024['neutral-foot'],
    minWidth: 0,
  },
  txInterAddressExplain: { flexShrink: 1, width: '60%' },
  txInterAddressExplainApprove: { width: '100%' },
  txChange: { flexShrink: 0, maxWidth: '50%', minWidth: 0 },
  divider: {
    height: 0.5,
    backgroundColor: colors2024['neutral-line'],
    opacity: 0.5,
    marginHorizontal: 12,
  },
}));
