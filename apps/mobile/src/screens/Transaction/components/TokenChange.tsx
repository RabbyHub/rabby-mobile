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
import { numberWithCommasIsLtOne } from '@/utils/number';
import { createGetStyles2024 } from '@/utils/styles';
import { useTheme2024 } from '@/hooks/theme';
import TokenLabel from './TokenLabel';

const TxChangeItem = ({
  item,
  tokenDict,
  data,
  isSend,
  canClickToken = true,
}: {
  data: TxHistoryItem;
  item: TxHistoryItem['sends'][0] | TxDisplayItem['receives'][0];
  tokenDict: /* TxDisplayItem['tokenDict'] */ Record<
    string,
    TokenItem | NFTItem
  >;
  isSend?: boolean;
  canClickToken?: boolean;
}) => {
  const { styles } = useTheme2024({ getStyle });
  const tokenId = item.token_id;
  const tokenUUID = `${data.chain}_token:${tokenId}`;
  const token = tokenDict[tokenId] || tokenDict[tokenUUID];
  const isNft = item.token_id?.length === 32;

  const tokenChangeStyle = StyleSheet.flatten([
    styles.text,
    isSend ? styles.textNegative : null,
  ]) as StyleProp<TextStyle>;

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
      ) : (token as TokenItem)?.logo_url ? (
        <Image
          source={{
            uri: (token as TokenItem).logo_url,
          }}
          style={styles.media}
        />
      ) : (
        <RcIconUnknown width={14} height={14} />
      )}

      <Text
        style={[tokenChangeStyle, styles.tokenChangeDelta]}
        numberOfLines={1}>
        {isSend ? '-' : '+'}{' '}
        {isNft ? item.amount : numberWithCommasIsLtOne(item.amount, 2)}
      </Text>
      <TokenLabel
        disableClickToken={!canClickToken}
        style={[tokenChangeStyle, styles.tokenLabel]}
        {...(isNft
          ? { token: token as NFTItem, isNft }
          : { token: token as TokenItem })}
        isMyOwn={!isSend}
      />
    </View>
  );
};
export const TxChange = ({
  data,
  tokenDict,
  canClickToken,
  style,
}: {
  data: TxDisplayItem;
  tokenDict: TxDisplayItem['tokenDict'];
  canClickToken?: boolean;
} & RNViewProps) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <View style={[styles.container, style]}>
      {data?.sends?.map(item => (
        <TxChangeItem
          isSend
          canClickToken={canClickToken}
          key={item.token_id}
          data={data}
          tokenDict={tokenDict}
          item={item}
        />
      ))}
      {data?.receives?.map(item => (
        <TxChangeItem
          canClickToken={canClickToken}
          key={item.token_id}
          data={data}
          tokenDict={tokenDict}
          item={item}
        />
      ))}
    </View>
  );
};

const ChangeSizes = {
  gap: 2,
};
const getStyle = createGetStyles2024(({ colors }) => ({
  container: {
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
    flexShrink: 1,
  },
  item: {
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
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors['green-default'],
    minWidth: 0,
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: 'SF Pro Rounded',
  },
  tokenChangeDelta: {
    justifyContent: 'flex-end',
  },
  textNegative: {
    color: colors['neutral-body'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  tokenLabel: {
    position: 'relative',
    top: 0,
  },
}));
