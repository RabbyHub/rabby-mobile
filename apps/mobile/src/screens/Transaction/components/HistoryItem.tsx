/* eslint-disable react-native/no-inline-styles */
import { getChain } from '@/utils/chain';
import { TokenItem, TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
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
import { getHistoryItemType } from './utils';
import { TxStatusItem } from '../HistoryDetailScreen';
import { useTranslation } from 'react-i18next';
import { BuyHistoryItem } from '@/components2024/HistoryItem/BuyHistoryItem';
import { HistoryItemCateType } from './type';
import ChainIconImage from '@/components/Chain/ChainIconImage';
import { HistoryItemTokenArea } from './HistoryItemTokenArea';
import { getTokenSymbol } from '@/utils/token';

type HistoryItemProps = {
  style?: StyleProp<ViewStyle>;
  data: HistoryDisplayItem;
  isForMultipleAdderss?: boolean;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

export type TokenChangeDataItem = {
  amount: number;
  token?: TokenItem;
  token_id: string;
  price?: number;
  type: 'send' | 'receive' | 'approve';
};

export const HistoryItem = React.memo(
  ({ data, tokenDict, style, isForMultipleAdderss }: HistoryItemProps) => {
    const { t } = useTranslation();
    const isFailed = data.tx?.status === 0;
    const isShowSuccess = data.isShowSuccess;
    const isScam = data.is_scam;
    const isSmallUsdTx = data.isSmallUsdTx;
    const chainItem = getChain(data.chain);
    const { styles, isLight } = useTheme2024({ getStyle });

    const formatType: HistoryItemCateType = useMemo(() => {
      return getHistoryItemType(data);
    }, [data]);

    const tokenApproveData = useMemo(() => {
      const res: TokenChangeDataItem[] = [];

      if (!data.token_approve?.token_id) {
        return res;
      }

      const tokenId = data.token_approve?.token_id || '';
      const tokenUUID = `${data.chain}_token:${tokenId}`;
      const token = tokenDict[tokenId] || tokenDict[tokenUUID];
      res.push({
        amount: data.token_approve?.value!,
        token,
        token_id: tokenId,
        type: 'approve',
      });

      return res;
    }, [data, tokenDict]);

    const formatTitle = useMemo(() => {
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
      let address = '';
      const project = data.project_id
        ? data.projectDict[data.project_id]
        : null;
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

          const name = project
            ? project.name
            : getAliasName(addr) || ellipsisAddress(addr);
          address = (isSend ? ToText : FromText) + name;
          break;

        case HistoryItemCateType.Buy:
          address = FromText + data.buyDetails?.service_provider?.name;
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
          <Text style={styles.describeText}>{address}</Text>
        </View>
      );
    }, [formatType, data, chainItem, t, styles.describeText]);

    const navigation = useRabbyAppNavigation();
    const handleNavigateDetail = useCallback(() => {
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.HistoryDetail,
        params: {
          isForMultipleAdderss,
          data,
          title: formatTitle,
        },
      });
    }, [navigation, isForMultipleAdderss, data, formatTitle]);

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
          const tokenUUID = `${data.chain}_token:${tokenId}`;
          const token = tokenDict[tokenId] || tokenDict[tokenUUID];
          return {
            amount: item.amount,
            token,
            token_id: tokenId,
            price: item.price as number,
            type: 'receive' as TokenChangeDataItem['type'],
          };
        })
        .sort((a, b) => {
          if (a.token.is_core === b.token.is_core) {
            return a.amount * a.price - b.amount * b.price;
          }
          return a.token.is_core ? -1 : 1;
        });

      const sends = data.sends
        .map(item => {
          const tokenId = item?.token_id;
          const tokenUUID = `${data.chain}_token:${tokenId}`;
          const token = tokenDict[tokenId] || tokenDict[tokenUUID];
          return {
            amount: item.amount,
            token,
            token_id: tokenId,
            price: item.price as number,
            type: 'send' as TokenChangeDataItem['type'],
          };
        })
        .sort((a, b) => {
          if (a.token.is_core === b.token.is_core) {
            return a.amount * a.price - b.amount * b.price;
          }
          return a.token.is_core ? 1 : -1;
        });
      return [...receives, ...sends];
    }, [data, tokenDict]);

    if (formatType === HistoryItemCateType.Buy && data.buyDetails) {
      return (
        <TouchableOpacity
          onPress={handleNavigateDetail}
          style={{ marginBottom: 8 }}>
          <BuyHistoryItem data={data.buyDetails} />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity onPress={handleNavigateDetail}>
        <View
          style={[
            styles.card,
            style,
            isScam || isSmallUsdTx ? styles.cardGray : null,
          ]}>
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
                  {isShowSuccess && (
                    <TxStatusItem status={1} showSuccess={true} />
                  )}
                  <TxStatusItem status={data.tx?.status ?? 1} />
                </View>
                {formatDescribe}
              </View>
            </View>
            <TxChange
              tokenChangeData={tokenChangeData}
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
    backgroundColor: colors2024['neutral-line'],
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  scam: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 12,
    lineHeight: 14,
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
