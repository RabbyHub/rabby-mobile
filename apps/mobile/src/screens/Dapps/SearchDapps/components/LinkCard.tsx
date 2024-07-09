import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { isPossibleDomain } from '@/utils/url';
import React, { useMemo } from 'react';
import { StyleProp, Text, ViewStyle } from 'react-native';
import RcIconGlobe from '@/assets/icons/dapp/icon-globe.svg';
import RcIconJump from '@/assets/icons/dapp/icon-jump.svg';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { isOrHasWithAllowedProtocol } from '@/constant/dappView';
import { createGetStyles } from '@/utils/styles';
import { stringUtils, urlUtils } from '@rabby-wallet/base-utils';

export const LinkCard = ({
  url,
  onPress,
  style,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (origin: string) => void;
}) => {
  const { styles } = useThemeStyles(getStyles);

  const _url = useMemo(() => {
    const str = url.trim().toLowerCase();
    if (!str) return null;
    const parsedResult = urlUtils.safeParseURL(str);
    if (
      parsedResult?.protocol &&
      !isOrHasWithAllowedProtocol(parsedResult?.protocol)
    )
      return null;

    if (isPossibleDomain(str)) return stringUtils.ensurePrefix(str, 'https://');
  }, [url]);

  if (_url) {
    return (
      <TouchableOpacity
        onPress={() => onPress?.(_url)}
        style={[styles.card, style]}>
        <RcIconGlobe />
        <Text style={styles.text} numberOfLines={1}>
          {_url}
        </Text>
        <RcIconJump />
      </TouchableOpacity>
    );
  }

  return null;
};

const getStyles = createGetStyles(
  (colors: ReturnType<typeof useThemeColors>) => ({
    card: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    text: {
      flex: 1,
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
    },
  }),
);
