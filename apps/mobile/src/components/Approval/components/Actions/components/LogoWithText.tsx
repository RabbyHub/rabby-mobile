import { Image, View } from 'react-native';
import React, { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import IconUnknown from 'ui/assets/token-default.svg';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      display: 'flex',
      alignItems: 'center',
    },
    logo: {
      width: 16,
      height: 16,
      marginRight: 6,
    },
    text: {
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'],
      marginRight: 4,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  });

const LogoWithText = ({
  logo,
  text,
  icon,
  logoRadius,
  logoSize = 16,
  textStyle = {},
}: {
  logo?: string;
  text: string | ReactNode;
  icon?: ReactNode;
  logoRadius?: number;
  logoSize?: number;
  textStyle?: React.CSSProperties;
  className?: string;
}) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);

  return (
    <View style={styles.wrapper}>
      {logo ? (
        <Image
          src={logo}
          source={{
            uri: logo,
          }}
          style={{
            ...styles.logo,
            borderRadius: logoRadius,
            width: logoSize,
            height: logoSize,
          }}
        />
      ) : (
        <IconUnknown
          style={{
            ...styles.logo,
            borderRadius: logoRadius,
            width: logoSize,
            height: logoSize,
          }}
        />
      )}
      <div
        style={{
          ...styles.text,
          ...textStyle,
        }}>
        {text}
      </div>
      {icon || null}
    </View>
  );
};

export default LogoWithText;
