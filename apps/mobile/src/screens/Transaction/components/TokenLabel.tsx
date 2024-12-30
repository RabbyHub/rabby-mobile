import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import TouchableText from '@/components/Touchable/TouchableText';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { NFTItem, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Text } from 'react-native';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { useNFTDetailSheetModalOnHistory } from '@/screens/NftDetail/hooks';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { naviPush } from '@/utils/navigation';
import { RootNames } from '@/constant/layout';
import { ensureAbstractPortfolioToken } from '@/screens/Home/utils/token';

export default function TokenLabel({
  token,
  isNft,
  isMyOwn,
  disableClickToken: propDisableClick,
  style,
  address,
}: RNViewProps & {
  isMyOwn?: boolean;
  disableClickToken?: boolean;
  address?: KeyringAccountWithAlias;
} & (
    | {
        token: TokenItem;
        isNft?: false;
      }
    | {
        token: NFTItem;
        isNft: true;
      }
  )) {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();

  const symbolName = useMemo(() => {
    const symbol = isNft ? '' : getTokenSymbol(token);

    return isNft
      ? token?.name ||
          (symbol ? `${symbol} ${token?.inner_id}` : t('global.unknownNFT'))
      : symbol;
  }, [t, isNft, token]);

  const { openTokenDetailPopup, setTokenDetailAddress } =
    useGeneralTokenDetailSheetModal();
  const { handlePressNftToken } = useNFTDetailSheetModalOnHistory();

  const disableClickToken = propDisableClick || (isNft && !isMyOwn);

  if (disableClickToken)
    return (
      <Text style={style} numberOfLines={1} ellipsizeMode="tail">
        {symbolName}
      </Text>
    );

  return (
    <TouchableText
      onPress={() => {
        if (disableClickToken) return;

        if (isNft) {
          handlePressNftToken(token, { needSendButton: isMyOwn });
        } else {
          // if (address) {
          //   setTokenDetailAddress(address);
          // }
          // openTokenDetailPopup(token as TokenItem);
          naviPush(RootNames.TokenDetail, {
            token: ensureAbstractPortfolioToken(token),
            account: address,
          });
        }
      }}
      disabled={disableClickToken}
      style={[!disableClickToken && styles.clickable, style]}
      numberOfLines={1}
      ellipsizeMode="tail">
      {symbolName}
    </TouchableText>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    clickable: {
      textDecorationLine: 'underline',
    },
  };
});
