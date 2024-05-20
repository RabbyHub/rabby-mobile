import { default as RcIconSend } from '@/assets/icons/history/send.svg';
import { IconDefaultNFT } from '@/assets/icons/nft';
import { Media } from '@/components/Media';
import { getTokenSymbol } from '@/utils/token';
import {
  TxDisplayItem,
  TxHistoryItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { useTranslation } from 'react-i18next';
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
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import TokenLabel from './TokenLabel';
import { makeDebugBorder } from '@/utils/styles';

const TxChangeItem = ({
  item,
  tokenDict,
  data,
  isSend,
  canClickToken = true,
}: {
  data: TxHistoryItem;
  item: TxHistoryItem['sends'][0] | TxDisplayItem['receives'][0];
  tokenDict: TxDisplayItem['tokenDict'];
  isSend?: boolean;
  canClickToken?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
        style={[tokenChangeStyle, styles.tokenChangeDelta]}
        numberOfLines={1}>
        {isSend ? '-' : '+'}{' '}
        {isNft ? item.amount : numberWithCommasIsLtOne(item.amount, 2)}
      </Text>
      <TokenLabel
        canClickToken={canClickToken}
        style={[tokenChangeStyle, styles.tokenLabel]}
        token={token}
        isNft={isNft}
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
  const colors = useThemeColors();
  const styles = getStyles(colors);
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
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: ChangeSizes.gap,
      // ...makeDebugBorder()
    },
    media: {
      width: 14,
      height: 14,
      borderRadius: 2,
      // ...makeDebugBorder('red')
    },
    text: {
      fontSize: 13,
      lineHeight: 15,
      color: colors['green-default'],
      minWidth: 0,
      // flexGrow: 1,
      flexShrink: 1,
      textAlign: 'right',
    },
    tokenChangeDelta: {
      justifyContent: 'flex-end',
    },
    textNegative: {
      color: colors['neutral-body'],
    },
    tokenLabel: {
      position: 'relative',
      top: 0,
    },
  });
