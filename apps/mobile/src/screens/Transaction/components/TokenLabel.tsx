import React, { useCallback, useMemo } from 'react';
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
import { View } from 'react-native-reanimated/lib/typescript/Animated';
import { ellipsisOverflowedText } from '@/utils/text';

export default function TokenLabel({
  token,
  isNft,
  style,
}: RNViewProps & {
  isMyOwn?: boolean;
  disableClickToken?: boolean;
  isForMultipleAddress?: boolean;
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
      ? t('page.singleHome.sectionHeader.Nft')
      : getTokenSymbol(token);
  }, [t, isNft, token]);

  return (
    <Text style={style} numberOfLines={1} ellipsizeMode="tail">
      {ellipsisOverflowedText(symbolName, 6)}
    </Text>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    clickable: {
      // textDecorationLine: 'underline',
    },
  };
});
