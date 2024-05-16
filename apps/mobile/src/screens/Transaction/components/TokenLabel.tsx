import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import TouchableText from '@/components/Touchable/TouchableText';
import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { getTokenSymbol } from '@/utils/token';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { Text } from 'react-native';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';

export default function TokenLabel({
  token,
  isNft,
  // onClose,
  canClickToken,
  style,
}: RNViewProps & {
  token: TokenItem;
  isNft?: boolean;
  canClickToken?: boolean;
  // onClose?: () => void;
}) {
  const { styles } = useThemeStyles(getStyles);
  const { t } = useTranslation();
  const symbol = useMemo(() => getTokenSymbol(token), [token]);
  const name = useMemo(() => {
    return isNft
      ? token?.name ||
          (symbol ? `${symbol} ${token?.inner_id}` : t('global.unknownNFT'))
      : symbol;
  }, [t, isNft, token, symbol]);

  const { openTokenDetailPopup } = useGeneralTokenDetailSheetModal();

  if (!canClickToken)
    return (
      <Text style={style} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>
    );

  return (
    <TouchableText
      onPress={() => {
        if (!canClickToken) return;

        openTokenDetailPopup(token);
      }}
      disabled={!canClickToken}
      style={[canClickToken && styles.clickable, style]}
      numberOfLines={1}
      ellipsizeMode="tail">
      {name}
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
