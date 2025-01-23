import { findChainByServerID, getChain } from '@/utils/chain';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { sinceTime } from '@/utils/time';
import { TxDisplayItem } from '@rabby-wallet/rabby-api/dist/types';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import {
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { TxChange } from './TokenChange';
import { TxId } from './TxId';
import { TxInterAddressExplain } from './TxInterAddressExplain';
import React, { useCallback, useMemo } from 'react';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import { HistoryItemCateType, HistoryItemIcon } from './HistoryItemIcon';
import { getAliasName } from '@/core/apis/contact';
import { ellipsisAddress } from '@/utils/address';
import { strings } from '@/utils/i18n';
import { ellipsisOverflowedText } from '@/utils/text';
import { useRabbyAppNavigation } from '@/hooks/navigation';
import { RootNames } from '@/constant/layout';
import { fetchHistoryTokenUUId, getHistoryItemType } from './utils';
import { TxStatusItem } from '../HistoryDetailScreen';

type HistoryItemProps = {
  style?: StyleProp<ViewStyle>;
  data: HistoryDisplayItem;
  isForMultipleAdderss?: boolean;
} & Pick<TxDisplayItem, 'cateDict' | 'projectDict' | 'tokenDict'>;

export const HistoryItem = React.memo(
  ({
    data,
    cateDict,
    projectDict,
    tokenDict,
    style,
    isForMultipleAdderss,
  }: HistoryItemProps) => {
    const isFailed = data.tx?.status === 0;
    const isShowSuccess = data.isShowSuccess;
    const isScam = data.is_scam;
    const chainItem = getChain(data.chain);
    const { styles } = useTheme2024({ getStyle });

    const formatType: HistoryItemCateType = useMemo(() => {
      return getHistoryItemType(data);
    }, [data]);

    const { formatToken, isNft } = useMemo(() => {
      const cate = formatType;
      const isDoubleToken =
        cate === HistoryItemCateType.Swap ||
        cate === HistoryItemCateType.Bridge;
      if (isDoubleToken) {
        const send = data.sends[0];
        const receive = data.receives[0];
        const sendToken =
          tokenDict[send.token_id] ||
          tokenDict[fetchHistoryTokenUUId(send.token_id, data.chain)];
        const receiveToken =
          tokenDict[receive.token_id] ||
          tokenDict[fetchHistoryTokenUUId(receive.token_id, data.chain)];

        return {
          formatToken: [sendToken, receiveToken],
          isNft: false,
        };
      } else {
        const isApprove =
          cate === HistoryItemCateType.Approve ||
          cate === HistoryItemCateType.Revoke;
        const commonItem =
          cate === HistoryItemCateType.Send ? data.sends[0] : data.receives[0];

        const tokenId = isApprove
          ? (data.token_approve?.token_id as string)
          : commonItem?.token_id;
        const tokenIsNft = tokenId?.length === 32;
        const tokenUUID = `${data.chain}_token:${tokenId}`;
        const token = tokenDict[tokenId] || tokenDict[tokenUUID];

        return {
          formatToken: token,
          isNft: tokenIsNft,
        };
      }
    }, [data, tokenDict, formatType]);

    const formatTitle = useMemo(() => {
      switch (formatType) {
        case HistoryItemCateType.Swap:
          return strings('page.transactions.itemTitle.Swap');

        case HistoryItemCateType.Send:
          return strings('page.transactions.itemTitle.Send');
        case HistoryItemCateType.Recieve:
          return strings('page.transactions.itemTitle.Recieve');
        case HistoryItemCateType.Bridge:
          return strings('page.transactions.itemTitle.Bridge');

        case HistoryItemCateType.Approve:
          return strings('page.transactions.itemTitle.Approve');
        case HistoryItemCateType.Revoke:
          return strings('page.transactions.itemTitle.Revoke');
        case HistoryItemCateType.Contract:
          return strings('page.transactions.itemTitle.Contract');
        case HistoryItemCateType.Cancel:
          return strings('page.transactions.itemTitle.Cancel');
        case HistoryItemCateType.UnKnown:
          return strings('page.transactions.itemTitle.Default');
        default:
          return data.tx?.name
            ? ellipsisOverflowedText(data.tx?.name, 15)
            : strings('page.transactions.itemTitle.Default');
      }
    }, [formatType, data]);

    const formatDescribe = useMemo(() => {
      const FromText = strings('page.swap.from') + ' ';
      const ToText = strings('page.swap.to') + ' ';
      const projectName = data?.project_id
        ? projectDict[data?.project_id]?.name
        : '';
      switch (formatType) {
        case HistoryItemCateType.Swap:
          return chainItem?.name || strings('page.transactions.detail.Unknown');

        case HistoryItemCateType.Send:
        case HistoryItemCateType.Recieve:
          const isSend = formatType === HistoryItemCateType.Send;
          const addr = isSend
            ? data.sends[0].to_addr
            : data.receives[0].from_addr;
          return (
            (isSend ? ToText : FromText) +
            (getAliasName(addr) || ellipsisAddress(addr))
          );
        case HistoryItemCateType.Revoke:
        case HistoryItemCateType.Approve:
          const isRevoke = formatType === HistoryItemCateType.Revoke;
          return isRevoke
            ? FromText +
                (projectName || strings('page.transactions.detail.Unknown'))
            : ToText +
                (projectName || strings('page.transactions.detail.Unknown'));
        case HistoryItemCateType.Contract:
          return FromText + chainItem?.name;
        case HistoryItemCateType.Cancel:
          return strings('page.transactions.detail.Unknown');
        default:
          return strings('page.transactions.detail.Unknown');
      }
    }, [formatType, data, chainItem, projectDict]);

    const navigation = useRabbyAppNavigation();
    const hanldeNavigateDetail = useCallback(() => {
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.HistoryDetail,
        params: {
          isForMultipleAdderss,
          data,
          title: formatTitle,
        },
      });
    }, [isForMultipleAdderss, navigation, data, formatTitle]);

    return (
      <TouchableOpacity onPress={hanldeNavigateDetail}>
        <View style={[styles.card, style, isScam ? styles.cardGray : null]}>
          <View style={styles.cardBody}>
            {/* <TxInterAddressExplain
            style={[
              styles.txInterAddressExplain,
              data?.cate_id === 'approve' &&
                styles.txInterAddressExplainApprove,
            ]}
            data={data}
            projectDict={projectDict}
            tokenDict={tokenDict}
            cateDict={cateDict}
            isScam={isScam}
          /> */}
            <View style={styles.leftContent}>
              <HistoryItemIcon
                type={formatType as HistoryItemCateType}
                token={formatToken}
                isNft={isNft}
              />
              <View style={styles.textBox}>
                <View style={styles.titleBox}>
                  <Text style={styles.titleText} numberOfLines={1}>
                    {formatTitle}
                  </Text>
                  {isShowSuccess && (
                    <TxStatusItem status={1} showSuccess={true} />
                  )}
                  <TxStatusItem status={data.tx?.status || 0} />
                </View>
                <Text style={styles.describeText} numberOfLines={1}>
                  {formatDescribe}
                </Text>
              </View>
            </View>
            <TxChange
              type={formatType as HistoryItemCateType}
              isForMultipleAdderss={isForMultipleAdderss}
              style={styles.txChange}
              data={data}
              tokenDict={tokenDict}
              canClickToken
            />
          </View>

          {/* {(data.tx && data.tx?.eth_gas_fee) || isFailed ? (
          <>
            <View style={styles.divider} />
            <View style={styles.cardFooter}>
              {data.tx && data.tx?.eth_gas_fee ? (
                <Text style={styles.gas}>
                  Gas: {numberWithCommasIsLtOne(data.tx?.eth_gas_fee, 2)}{' '}
                  {chainItem?.nativeTokenSymbol} ($
                  {numberWithCommasIsLtOne(data.tx?.usd_gas_fee ?? 0, 2)})
                </Text>
              ) : null}
              {isFailed ? <Text style={styles.failed}>Failed</Text> : null}
            </View>
          </>
        ) : null} */}
        </View>
      </TouchableOpacity>
    );
  },
);

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  card: {
    borderRadius: 20,
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    marginBottom: 12,
    // borderColor: colors2024['neutral-line'],
    // borderWidth: 1,
  },
  titleBox: {
    flexDirection: 'row',
    gap: 6,
  },
  cardGray: {
    opacity: 0.5,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // width: '50%',
  },
  textBox: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  titleText: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
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
    paddingHorizontal: 12,
    paddingVertical: 14,
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
  txChange: { flexShrink: 0, maxWidth: '70%' },
  divider: {
    height: 0.5,
    backgroundColor: colors2024['neutral-line'],
    opacity: 0.5,
    marginHorizontal: 12,
  },
}));
