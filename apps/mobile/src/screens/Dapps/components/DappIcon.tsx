import { useThemeStyles } from '@/hooks/theme';
import { getOriginName, hashCode } from '@/utils/common';
import { createGetStyles } from '@/utils/styles';
import { Image } from '@rneui/themed';
import { set } from 'lodash';
import React, { useMemo } from 'react';
import {
  ImageStyle,
  ImageURISource,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import FastImage, { FastImageProps } from 'react-native-fast-image';

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
  style?: StyleProp<ViewStyle>;
  origin: string;
  source?: Exclude<FastImageProps['source'], number>;
}) => {
  const { colors, styles, isLight } = useThemeStyles(getStyles);
  const [bgColor, originName] = useMemo(() => {
    const bgIndex = Math.abs(hashCode(origin) % 12);

    return [bgColorList[bgIndex]?.toLowerCase(), getOriginName(origin || '')];
  }, [origin]);

  const [loaded, setLoaded] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

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
      <View style={[{ overflow: 'hidden' }, style]}>
        {/* <Image
          source={source}
          style={styles.image}
          PlaceholderContent={Placeholder}
          placeholderStyle={styles.placeholderStyle}
        /> */}
        <FastImage
          source={source}
          style={[styles.image]}
          resizeMode={FastImage.resizeMode.cover}
          onLoadStart={() => {
            setLoaded(false);
            setIsError(false);
          }}
          onLoadEnd={() => {
            setLoaded(true);
          }}
          onError={() => {
            setIsError(true);
          }}
        />
        {!loaded || isError ? (
          <View style={styles.placeholderContainer}>{Placeholder}</View>
        ) : null}
      </View>
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
  image: {
    width: '100%',
    height: '100%',
  },
  placeholderStyle: {
    backgroundColor: 'transparent',
  },
  placeholderContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
