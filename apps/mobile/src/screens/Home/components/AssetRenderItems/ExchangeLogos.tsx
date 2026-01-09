import React, { useMemo } from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Image, Text, View } from 'react-native';

interface Props {
  logos: string[];
}
const MAX_CEX_LENGTH = 3;
export const ExchangeLogos = ({ logos }: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const displayLogos = useMemo(() => {
    if (logos.length > MAX_CEX_LENGTH) {
      return logos.slice(0, MAX_CEX_LENGTH);
    }
    return logos;
  }, [logos]);

  if (logos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {displayLogos.map(logo => (
        <Image key={logo} source={{ uri: logo }} style={styles.logo} />
      ))}
      {logos.length > MAX_CEX_LENGTH && (
        <Text style={styles.moreCex}>+{logos.length - MAX_CEX_LENGTH}</Text>
      )}
    </View>
  );
};

const getStyles = createGetStyles2024(({ colors2024 }) => ({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  logo: {
    width: 12,
    height: 12,
    borderRadius: 12,
  },
  line: {
    width: 1,
    height: 12,
    backgroundColor: colors2024['blue-light-disable'],
  },
  moreCex: {
    color: colors2024['neutral-secondary'],
    fontSize: 11,
    lineHeight: 12,
    fontWeight: 400,
  },
}));
