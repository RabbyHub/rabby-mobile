import { Colors } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { isPossibleDomain } from '@/utils/url';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import RcIconGlobe from '@/assets/icons/dapp/icon-globe.svg';
import RcIconJump from '@/assets/icons/dapp/icon-jump.svg';

export const LinkCard = ({
  url,
  onPress,
  style,
}: {
  url: string;
  style?: StyleProp<ViewStyle>;
  onPress?: (origin: string) => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const str = url.trim();
  const _url = isPossibleDomain(str)
    ? /^\w+:\/\//.test(str)
      ? str
      : `https://${str}`
    : '';
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

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
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
  });
