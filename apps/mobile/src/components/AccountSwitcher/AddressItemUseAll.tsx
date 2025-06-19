import {
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme2024 } from '@/hooks/theme';

import PrivateKeyPNG from '@/assets2024/icons/wallet/private-key.png';
import SeedPNG from '@/assets2024/icons/wallet/seed.png';
import RcIconCorrectCC from './icons/correct-cc.svg';

import { createGetStyles2024, makeDebugBorder } from '@/utils/styles';
import { useCallback, useMemo, useState } from 'react';
import { Account } from '@/core/services/preference';
import { getWalletAvator2024 } from '@/utils/walletInfo2024';
import { SvgProps } from 'react-native-svg';
import { AddressItemSizes } from './AddressItemInPanel';

const ImagesList = [PrivateKeyPNG, SeedPNG, SeedPNG];

export default function AllAddressIcon({
  imageSourceList = [],
  containerWidth = 58,
  size = 40,
  imageRadius = 6,
  imageGap = 6,
}: {
  imageSourceList: (ImageSourcePropType | React.FC<SvgProps>)[];
  containerWidth?: number;
  size?: number;
  imageRadius?: number;
  imageGap?: number;
}) {
  const { styles } = useTheme2024({
    getStyle: getAllAddressIconStyle,
  });

  if (!imageSourceList.length) {
    return null;
  }

  return (
    <View style={[styles.container, { width: containerWidth, height: size }]}>
      {imageSourceList.map((image, index) => {
        const k = `image-item-${index}-${image}`;

        const Icon = image;
        let imageNode =
          typeof Icon === 'function' ? (
            <Icon
              width={size}
              height={size}
              style={StyleSheet.flatten([
                {
                  borderRadius: imageRadius,
                  width: size,
                  height: size,
                },
              ])}
            />
          ) : (
            <Image
              style={[
                styles.image,
                { width: size, height: size, borderRadius: imageRadius },
              ]}
              source={Icon}
            />
          );

        return (
          <View
            key={k}
            style={[
              styles.iconWrapper,
              {
                left: (ImagesList.length - index - 1) * imageGap,
                zIndex: 100 - index,
              },
            ]}>
            {imageNode}
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
  allAccounts = [],
  isSelected,
  style,
  onPress,
}: {
  allAccounts: Account[];
  isSelected?: boolean;
  onPress?: () => void;
} & RNViewProps) {
  const { styles, colors2024, isLight } = useTheme2024({
    getStyle: getUseAllAccountsItemInPanelStyle,
  });

  const [isPressing, setIsPressing] = useState(false);

  const onPressAddress = useCallback(() => {
    onPress?.();
  }, [onPress]);

  const imageSourceList = useMemo(() => {
    return allAccounts
      .slice(0, 3)
      .reverse()
      .map(account =>
        getWalletAvator2024(account.brandName, isLight, account.address),
      )
      .filter(Boolean) as ImageSourcePropType[];
  }, [allAccounts, isLight]);

  if (!allAccounts.length) {
    console.warn('UseAllAccountsItemInPanel: allAccounts is empty');
    return null;
  }

  const addressCount = allAccounts.length > 10 ? 10 : allAccounts.length;

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
        <View style={[styles.leftArea, { marginLeft: -0, marginRight: 8 }]}>
          <AllAddressIcon
            imageSourceList={imageSourceList}
            size={24}
            containerWidth={50}
            imageRadius={8}
            imageGap={14}
          />
        </View>
        <View style={styles.centerInfo}>
          <Text style={styles.text}>
            {'All '}
            {addressCount} {addressCount > 1 ? 'Wallets' : 'Wallet'}
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
      borderRadius: AddressItemSizes.radiusValue,
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: ctx.colors2024['neutral-line'],
      backgroundColor: ctx.colors2024['neutral-bg-3'],
      paddingHorizontal: 16,
      paddingVertical: 0,
      position: 'relative',
      height: 78,
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
