import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { SvgProps } from 'react-native-svg';
import ArrowRightCC from '@/assets2024/icons/common/arrow-right-cc.svg';
import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';
import { ThemeColors2024 } from '@/constant/theme';

const RcIconRight = makeThemeIconFromCC(ArrowRightCC, {
  onLight: ThemeColors2024.light['neutral-title-1'],
  onDark: ThemeColors2024.dark['neutral-title-1'],
});

export interface ListItemProps {
  iconSrc?: string;
  Icon?: React.FC<SvgProps> | React.ReactElement<any, any>;
  title: string;
  subText?: string;
  onPress?: () => void;
  disableArrow?: boolean;
}

export const ListItem: React.FC<ListItemProps> = ({
  onPress,
  title,
  subText,
  Icon,
  iconSrc,
  disableArrow = false,
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <TouchableOpacity disabled={!onPress} onPress={onPress} style={styles.root}>
      <View style={styles.leftContainer}>
        {iconSrc ? (
          <Image
            source={{ uri: iconSrc }}
            style={styles.image}
            width={styles.image.width}
            height={styles.image.height}
          />
        ) : Icon ? (
          typeof Icon === 'function' ? (
            <Icon width={styles.image.width} height={styles.image.height} />
          ) : (
            Icon
          )
        ) : null}
        <View style={styles.textContainer}>
          <Text style={styles.text}>{title}</Text>
          {subText ? <Text style={styles.subText}>{subText}</Text> : null}
        </View>
      </View>
      {onPress && !disableArrow ? <RcIconRight /> : null}
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  image: {
    width: 48,
    height: 48,
  },
  textContainer: {
    gap: 4,
  },
  text: {
    fontSize: 18,
    lineHeight: 22,
    color: colors2024['neutral-title-1'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
  },
  subText: {
    fontSize: 15,
    lineHeight: 20,
    color: colors2024['neutral-body'],
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
  },
}));
