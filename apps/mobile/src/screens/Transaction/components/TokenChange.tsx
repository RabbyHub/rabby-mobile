import { default as RcIconSend } from '@/assets/icons/history/send.svg';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import { getTokenSymbol } from '@/utils/token';
import {
  TxDisplayItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';
import RcIconUnknown from '@/assets/icons/token/default.svg';
import { numberWithCommasIsLtOne } from '@/utils/number';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const TxChangeItem = ({
  item,
  tokenDict,
  data,
  isSend,
}: {
  data: TxHistoryItem;
  item: TxHistoryItem['sends'][0] | TxDisplayItem['receives'][0];
  tokenDict: TxDisplayItem['tokenDict'];
  isSend?: boolean;
}) => {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const tokenId = item.token_id;
  const tokenUUID = `${data.chain}_token:${tokenId}`;
  const token = tokenDict[tokenId] || tokenDict[tokenUUID];
  const isNft = item.token_id?.length === 32;
  const symbol = getTokenSymbol(token);
  const name = isNft
    ? token?.name ||
      (symbol ? `${symbol} ${token?.inner_id}` : t('global.unknownNFT'))
    : symbol;
  return (
    <View style={styles.item}>
      {isNft ? (
        <Media
          failedPlaceholder={<IconDefaultNFT width={14} height={14} />}
          type={token?.content_type}
          src={token?.content?.endsWith('.svg') ? '' : token?.content}
          thumbnail={token?.content?.endsWith('.svg') ? '' : token?.content}
          playIconSize={14}
          mediaStyle={styles.media}
          style={styles.media}
        />
      ) : token?.logo_url ? (
        <Image
          source={{
            uri: token.logo_url,
          }}
          style={styles.media}
        />
      ) : (
        <RcIconUnknown width={14} height={14} />
      )}
      <Text
        style={[styles.text, isSend ? styles.textNegative : null]}
        numberOfLines={1}>
        {isSend ? '-' : '+'}{' '}
        {isNft ? item.amount : numberWithCommasIsLtOne(item.amount, 2)} {name}
      </Text>
    </View>
  );
};
export const TxChange = ({
  data,
  tokenDict,
}: {
  data: TxDisplayItem;
  tokenDict: TxDisplayItem['tokenDict'];
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      {data?.sends?.map(item => (
        <TxChangeItem
          isSend
          key={item.token_id}
          data={data}
          tokenDict={tokenDict}
          item={item}
        />
      ))}
      {data?.receives?.map(item => (
        <TxChangeItem
          key={item.token_id}
          data={data}
          tokenDict={tokenDict}
          item={item}
        />
      ))}
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
      // alignItems: 'flex-end',
      gap: 3,
      minWidth: 0,
      // maxWidth: '50%',
      flexShrink: 1,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    image: {
      width: 14,
      height: 14,
      borderRadius: 14,
    },
    text: {
      fontSize: 13,
      lineHeight: 15,
      color: colors['green-default'],
      // flex: 1,
      minWidth: 0,
      flexGrow: 1,
      flexShrink: 1,
    },
    textNegative: {
      color: colors['neutral-body'],
    },
    media: {
      width: 14,
      height: 14,
      borderRadius: 2,
    },
  });
