import { useTheme2024 } from '@/hooks/theme';
import React from 'react';
import { ImageProps, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Text } from '@/components/Typography';
import { createGetStyles2024 } from '@/utils/styles';

export const TestnetChainLogo = ({
  size = 20,
  name,
  roundedSquare = false,
  ...props
}: React.PropsWithoutRef<
  Omit<ImageProps, 'source'> & {
    size?: number;
    name: string;
    roundedSquare?: boolean;
  }
>) => {
  const { colors2024, styles } = useTheme2024({ getStyle });
  if (roundedSquare) {
    return (
      <View
        style={[
          styles.square,
          { width: size, height: size, borderRadius: size / 3 },
          props.style,
        ]}>
        <Text style={styles.initials} numberOfLines={1}>
          {name.substring(0, 3).replace(/\s/g, '')}
        </Text>
      </View>
    );
  }
  const xml = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='${
    colors2024['neutral-foot']
  }'></circle><text x='16' y='20' dominant-baseline='middle' text-anchor='middle' fill='${
    colors2024['neutral-contrast']
  }' font-size='12' line-height='12' font-weight='700'>${encodeURIComponent(
    name.substring(0, 3).replace(/\s/g, ''),
  )}</text></svg>`;

  return (
    <SvgXml
      xml={xml}
      width={size}
      height={size}
      style={[{ height: size, width: size }, props.style]}
    />
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  square: {
    backgroundColor: colors2024['neutral-foot'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'SF Pro Rounded',
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 20,
    color: colors2024['neutral-InvertHighlight'],
  },
}));
