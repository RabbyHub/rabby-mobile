import RcIconStarFull from '@/assets/icons/dapp/icon-star-full.svg';
import RcIconStar from '@/assets/icons/dapp/icon-star.svg';
import RcIconTriangle from '@/assets/icons/dapp/icon-triangle.svg';
import { useThemeColors } from '@/hooks/theme';
import { getOriginName, hashCode } from '@/utils/common';
import { DappInfo } from '@rabby-wallet/service-dapp';
import React, { useMemo } from 'react';
import {
  Image,
  ImageStyle,
  ImageURISource,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native-gesture-handler';

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
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [bgColor, originName] = useMemo(() => {
    const bgIndex = Math.abs(hashCode(origin) % 12);

    return [bgColorList[bgIndex].toLowerCase(), getOriginName(origin || '')];
  }, [origin]);

  if (source) {
    return <Image source={source} style={style} />;
  }

  return (
    <View
      style={[
        styles.dappIcon,
        style,
        {
          backgroundColor: bgColor,
        },
      ]}>
      <Text style={styles.dappIconText}>{originName[0].toUpperCase()}</Text>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    dappIcon: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dappIconText: {
      fontSize: 15,
      fontWeight: '500',
      color: colors['neutral-card-1'],
    },
  });
