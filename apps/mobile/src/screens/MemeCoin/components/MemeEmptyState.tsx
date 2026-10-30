import React from 'react';
import { TouchableOpacity } from 'react-native';
import RcEmptyDog from '@/assets2024/memecoin/empty-dog.svg';
import { Text } from '@/components/Typography';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export const MemeEmptyState = ({
  text,
  onPress,
}: {
  text: string;
  onPress?: () => void;
}) => {
  const { styles } = useTheme2024({ getStyle });
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={!onPress}
      onPress={onPress}
      style={styles.container}>
      <RcEmptyDog width={55} height={40} />
      <Text style={styles.text}>{text}</Text>
    </TouchableOpacity>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  container: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 4,
  },
  text: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '400',
    color: colors2024['neutral-secondary'],
    textAlign: 'center',
  },
}));
