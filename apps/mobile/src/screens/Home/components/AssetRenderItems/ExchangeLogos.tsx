import React from 'react';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { Image, View } from 'react-native';

interface Props {
  logos: string[];
}
export const ExchangeLogos = ({ logos }: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  if (logos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      {logos.map(logo => (
        <Image key={logo} source={{ uri: logo }} style={styles.logo} />
      ))}
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
    backgroundColor: colors2024['blue-light-2'],
  },
}));
