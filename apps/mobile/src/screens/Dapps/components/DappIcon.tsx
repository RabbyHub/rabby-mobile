import { useThemeColors, useThemeStyles } from '@/hooks/theme';
import { getOriginName, hashCode } from '@/utils/common';
import { createGetStyles } from '@/utils/styles';
import { Image } from '@rneui/themed';
import React, { useMemo } from 'react';
import {
  // Image,
  ImageStyle,
  ImageURISource,
  StyleProp,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const bgColorList = [
  '#F69373',
  '#91D672',
  '#C0E36C',
  '#A47CDF',
  '#6BD5D6',
  '#ED7DBC',
  '#7C93EF',
  '#65BBC0',
  '#6EB7FB',
  '#6091CD',
  '#F6B56F',
  '#DFA167',
];

export const DappIcon = ({
  origin,
  style,
  source,
}: {
  style?: StyleProp<ImageStyle>;
  origin: string;
  source?: ImageURISource;
}) => {
  const { colors, styles, isLight } = useThemeStyles(getStyles);
  const [bgColor, originName] = useMemo(() => {
    const bgIndex = Math.abs(hashCode(origin) % 12);

    return [bgColorList[bgIndex].toLowerCase(), getOriginName(origin || '')];
  }, [origin]);

  const Placeholder = (
    <View
      style={[
        styles.dappIcon,
        style,
        {
          backgroundColor: bgColor,
        },
      ]}>
      <Text style={styles.dappIconText}>{originName[0]?.toUpperCase()}</Text>
    </View>
  );

  if (source?.uri) {
    return (
      <Image source={source} style={style} PlaceholderContent={Placeholder} />
    );
  }

  return Placeholder;
};

const getStyles = createGetStyles((colors, ctx) => ({
  dappIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dappIconText: {
    fontSize: 15,
    fontWeight: '500',
    color: ctx?.isLight ? colors['neutral-card-1'] : colors['neutral-title2'],
  },
}));
