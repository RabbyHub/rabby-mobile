import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import {
  NFTItem,
  TokenItem,
  TxDisplayItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import {
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';
import RcIconUnknown from '@/assets/icons/token/default.svg';
import { formatTokenAmount } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import TokenLabel from './TokenLabel';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { HistoryItemCateType } from './HistoryItemIcon';
import { getTokenSymbol } from '@/utils/token';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const TxChangeItem = ({
  item,
  tokenDict,
  data,
  isSend,
  canClickToken = true,
  isForMultipleAdderss,
  isBottomSend,
}: {
  isForMultipleAdderss?: boolean;
  data: HistoryDisplayItem;
  item: TxHistoryItem['sends'][0] | TxDisplayItem['receives'][0];
  tokenDict: /* TxDisplayItem['tokenDict'] */ Record<
    string,
    TokenItem | NFTItem
  >;
  isSend?: boolean;
  isBottomSend?: boolean;
  canClickToken?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const tokenId = item.token_id;
  const tokenUUID = `${data.chain}_token:${tokenId}`;
  const token = tokenDict[tokenId] || tokenDict[tokenUUID];
  const isNft = item.token_id?.length === 32;

  const tokenChangeStyle = StyleSheet.flatten([
    styles.text,
    isSend ? (isBottomSend ? styles.textNegative : styles.approveText) : null,
  ]) as StyleProp<TextStyle>;

  return (
    <View style={styles.item}>
      <Text
        style={[tokenChangeStyle, styles.tokenChangeDelta]}
        numberOfLines={1}>
        {isSend ? '-' : '+'}
        {isNft ? item.amount : formatTokenAmount(item.amount)}
      </Text>
      <TokenLabel
        isForMultipleAdderss={isForMultipleAdderss}
        disableClickToken={true}
        style={[tokenChangeStyle, styles.tokenLabel]}
        {...(isNft
          ? { token: token as NFTItem, isNft }
          : { token: token as TokenItem })}
        isMyOwn={!isSend}
        address={data.account}
      />
    </View>
  );
};
export const TxChange = ({
  data,
  type,
  tokenDict,
  canClickToken,
  style,
  isForMultipleAdderss,
}: {
  type: HistoryItemCateType;
  isForMultipleAdderss?: boolean;
  data: HistoryDisplayItem;
  tokenDict: TxDisplayItem['tokenDict'];
  canClickToken?: boolean;
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();
  const isApprove =
    type === HistoryItemCateType.Approve || type === HistoryItemCateType.Revoke;
  const singleAmount = data?.token_approve?.value;
  const appvoveAmmountStr = singleAmount
    ? singleAmount < 1e9
      ? formatTokenAmount(singleAmount)
      : t('page.transactions.detail.Unlimited')
    : '';
  const tokenId = data?.token_approve?.token_id || '';
  const tokenUUID = `${data?.chain}_token:${tokenId}`;
  const singeToken = tokenDict[tokenId] || tokenDict[tokenUUID];
  const tokenIsNft = tokenId?.length === 32;

  const hasMoreTxChange = useMemo(() => {
    const arr = [...data?.receives, ...data?.sends];
    return arr.length > 2;
  }, [data]);

  return (
    <View style={[styles.container, style]}>
      {isApprove && (
        <Text style={[styles.approveText]} numberOfLines={1}>
          {' '}
          {tokenIsNft ? singleAmount : appvoveAmmountStr}{' '}
          {tokenIsNft
            ? t('page.nft.title')
            : getTokenSymbol(singeToken as TokenItem)}
        </Text>
      )}
      {hasMoreTxChange ? (
        <View style={styles.rowBox}>
          <TxChangeItem
            isForMultipleAdderss={isForMultipleAdderss}
            canClickToken={canClickToken}
            key={data.receives[0]?.token_id || data.sends[0]?.token_id}
            data={data}
            isSend={!data.receives[0]?.token_id}
            tokenDict={tokenDict}
            item={data.receives[0] || data.sends[0]}
          />
          <Text style={styles.text}>...</Text>
        </View>
      ) : (
        <>
          {data?.receives?.map(item => (
            <TxChangeItem
              isForMultipleAdderss={isForMultipleAdderss}
              canClickToken={canClickToken}
              key={item?.token_id}
              data={data}
              tokenDict={tokenDict}
              item={item}
            />
          ))}
          {data?.sends?.map(item => (
            <TxChangeItem
              isForMultipleAdderss={isForMultipleAdderss}
              isSend
              isBottomSend={Boolean(data?.receives.length)}
              canClickToken={canClickToken}
              key={item?.token_id}
              data={data}
              tokenDict={tokenDict}
              item={item}
            />
          ))}
        </>
      )}
    </View>
  );
};

const ChangeSizes = {
  gap: 2,
};
const getStyle = createGetStyles2024(({ colors, colors2024 }) => ({
  container: {
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flexShrink: 1,
    height: 40,
  },
  rowBox: {
    gap: ChangeSizes.gap,
    flexDirection: 'row',
  },
  item: {
    flexShrink: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: ChangeSizes.gap,
  },
  media: {
    width: 14,
    height: 14,
    borderRadius: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors2024['green-default'],
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
  },
  tokenChangeDelta: {
    justifyContent: 'flex-end',
  },
  approveText: {
    color: colors['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  textNegative: {
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  tokenLabel: {
    position: 'relative',
    top: 0,
  },
}));
