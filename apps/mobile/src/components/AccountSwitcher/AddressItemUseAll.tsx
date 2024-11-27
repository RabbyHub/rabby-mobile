import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';

import PrivateKeyPNG from '@/assets2024/icons/wallet/private-key.png';
import SeedPNG from '@/assets2024/icons/wallet/seed.png';
import RcIconCorrectCC from './icons/correct-cc.svg';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useCallback, useState } from 'react';

const ImagesList = [PrivateKeyPNG, SeedPNG, SeedPNG];

export default function AllAddressIcon({
  containerWidth = 58,
  size = 40,
  imageRadius = 6,
  imageGap = 6,
}: {
  containerWidth?: number;
  size?: number;
  imageRadius?: number;
  imageGap?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getAllAddressIconStyle,
  });

  return (
    <View style={[styles.container, { width: containerWidth, height: size }]}>
      {ImagesList.map((image, index) => {
        const k = `image-item-${index}-${image}`;
        return (
          <View
            key={k}
            style={[
              styles.iconWrapper,
              { left: (ImagesList.length - index - 1) * imageGap },
            ]}>
            <Image
              style={[
                styles.image,
                { width: size, height: size, borderRadius: imageRadius },
              ]}
              source={image}
            />
          </View>
        );
      })}
      {/* <View style={[styles.iconWrapper, { left: 2 * 8 }]}><Image style={styles.image} source={PrivateKeyPNG} /></View>
      <View style={[styles.iconWrapper, { left: 1 * 8 }]}><Image style={styles.image} source={SeedPNG} /></View>
      <View style={[styles.iconWrapper, { left: 0 * 8 }]}><Image style={styles.image} source={SeedPNG} /></View> */}
    </View>
  );
}

const getAllAddressIconStyle = createGetStyles2024(ctx => {
  return {
    container: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      position: 'relative',
    },
    iconWrapper: {
      position: 'absolute',
    },
    image: {
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'white',
    },
  };
});

export function UseAllAccountsItemInPanel({
  addressCount,
  isSelected,
  style,
  onPress,
}: {
  addressCount: number;
  isSelected?: boolean;
  onPress?: () => void;
} & RNViewProps) {
  const { styles, colors2024 } = useTheme2024({
    getStyle: getUseAllAccountsItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = useState(false);

  const onPressAddress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={StyleSheet.flatten([
        styles.itemContainer,
        style,
        isSelected && styles.itemContainerCurrent,
        isPressing && styles.containerPressing,
      ])}
      activeOpacity={1}
      onPressIn={() => setIsPressing(true)}
      onPressOut={() => setIsPressing(false)}
      onPress={onPressAddress}>
      <View style={styles.itemInner}>
        <View style={[styles.leftArea, { marginLeft: -0, marginRight: 12 }]}>
          <AllAddressIcon size={26} containerWidth={40} imageRadius={8} />
        </View>
        <View style={styles.centerInfo}>
          <Text style={styles.text}>
            {addressCount} {addressCount > 1 ? 'Addresses' : 'Address'}
          </Text>
        </View>
        <View style={styles.rightArea}>
          {isSelected && (
            <RcIconCorrectCC
              color={colors2024['green-default']}
              width={16}
              height={16}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const getUseAllAccountsItemInPanelStyle = createGetStyles2024(ctx => {
  return {
    itemContainer: {
      borderRadius: 30,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: ctx.colors2024['neutral-line'],
      backgroundColor: ctx.colors2024['neutral-bg-3'],
      paddingHorizontal: 24,
      paddingVertical: 0,
      position: 'relative',
      height: 70,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    containerPressing: {
      borderColor: ctx.colors2024['brand-light-2'],
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    itemContainerCurrent: {
      backgroundColor: ctx.colors2024['brand-light-1'],
    },
    itemInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      width: '100%',
      height: 24,
    },
    leftArea: {
      flexShrink: 0,
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      height: '100%',
    },
    centerInfo: {
      flexShrink: 1,
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },
    text: {
      fontFamily: 'SF Pro Rounded',
      fontSize: 17,
      fontStyle: 'normal',
      fontWeight: '700',
      lineHeight: 22,
      color: ctx.colors2024['neutral-title-1'],
    },
    rightArea: {
      flexShrink: 0,
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      // ...makeDebugBorder('yellow'),
    },
  };
});
