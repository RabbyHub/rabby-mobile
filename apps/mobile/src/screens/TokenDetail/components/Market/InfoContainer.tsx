import React from 'react';
import { View, Text, ViewProps } from 'react-native';

import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

interface Props {
  title: string;
  children: React.ReactNode;
  style?: ViewProps['style'];
}
const InfoContainer = ({ title, children, style }: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.divider} />
      <View style={styles.content}>{children}</View>
    </View>
  );
};

export default InfoContainer;

const getStyles = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    position: 'relative',
    backgroundColor: isLight
      ? colors2024['neutral-bg-1']
      : colors2024['neutral-bg-2'],
    borderRadius: 16,
    overflow: 'hidden',
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    color: colors2024['neutral-title-1'],
    fontFamily: 'SF Pro Rounded',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  content: {
    // paddingHorizontal: 12,
    // paddingVertical: 12,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors2024['neutral-line'],
  },
}));
