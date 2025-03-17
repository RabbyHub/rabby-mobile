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
import { formatTokenAmount, formatUsdValue } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import TokenLabel from './TokenLabel';
import { HistoryDisplayItem } from '../MultiAddressHistory';
import { getTokenSymbol } from '@/utils/token';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryItemCateType } from './type';
import { ellipsisOverflowedText } from '@/utils/text';
import { fetchHistoryTokenUUId } from './utils';
import { TokenChangeDataItem } from './HistoryItem';

const TxChangeItem = ({
  item,
  isSend,
  amount,
}: {
  item: TokenItem | NFTItem;
  isSend?: boolean;
  amount: number;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const tokenId = item.id;
  const isNft = item.id?.length === 32;
  const { t } = useTranslation();

  const tokenChangeStyle = StyleSheet.flatten([
    styles.text,
    isSend ? styles.textNegative : null,
  ]) as StyleProp<TextStyle>;

  return (
    <View style={styles.item}>
      <Text
        style={[tokenChangeStyle, styles.tokenChangeDelta]}
        numberOfLines={1}
        ellipsizeMode="tail">
        {isSend ? '-' : '+'}
        {isNft ? amount : formatTokenAmount(amount)}{' '}
        {isNft
          ? t('page.singleHome.sectionHeader.Nft')
          : ellipsisOverflowedText(getTokenSymbol(item as TokenItem), 6)}
      </Text>
    </View>
  );
};

export const TxChange = ({
  style,
  tokenChangeData,
}: {
  tokenChangeData: TokenChangeDataItem[];
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle });
  const { t } = useTranslation();

  const filterRecieves = useMemo(() => {
    return tokenChangeData.filter(item => item.type === 'receive');
  }, [tokenChangeData]);

  const filterSends = useMemo(() => {
    return tokenChangeData.filter(item => item.type === 'send');
  }, [tokenChangeData]);

  const calcUsdValue = useCallback((item: TokenChangeDataItem) => {
    const { amount, price, token_id } = item;
    const isNft = token_id?.length === 32;
    if (isNft) {
      return '';
    }

    if (price) {
      return formatUsdValue(amount * price);
    }
    return '';
  }, []);

  return (
    <View style={[styles.container, style]}>
      <>
        {filterRecieves.length > 0 && (
          <>
            <View style={styles.rowBox}>
              <TxChangeItem
                key={filterRecieves[0].token_id}
                item={filterRecieves[0].token}
                amount={filterRecieves[0].amount}
              />
              {filterRecieves.length > 1 && (
                <Text style={styles.text}>...</Text>
              )}
            </View>
            {filterSends.length === 0 && (
              <Text style={styles.usdText}>
                {calcUsdValue(filterRecieves[0])}
              </Text>
            )}
          </>
        )}
        {filterSends.length > 0 && (
          <>
            <View style={styles.rowBox}>
              <TxChangeItem
                isSend={true}
                key={filterSends[0].token_id}
                item={filterSends[0].token}
                amount={filterSends[0].amount}
              />
              {filterSends.length > 1 && <Text style={styles.text}>...</Text>}
            </View>
            {filterRecieves.length === 0 && (
              <Text style={styles.text}>{calcUsdValue(filterSends[0])}</Text>
            )}
          </>
        )}
      </>
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
    // height: 40,
  },
  rowBox: {
    justifyContent: 'flex-end',
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
  usdText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
    color: colors2024['neutral-secondary'],
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
