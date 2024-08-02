import React, { useMemo } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createGetStyles } from '@/utils/styles';
import { useThemeColors } from '@/hooks/theme';
import { Spin } from '@/screens/TransactionRecord/components/Spin';

export const PendingTx = ({
  number,
  onClick,
}: {
  number: number | string;
  onClick?: () => void;
}) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.container} onPress={onClick}>
      <Spin color={colors['blue-default']} style={styles.icon} />
      <Text style={styles.number}>{number}</Text>
    </TouchableOpacity>
  );
};

const getStyles = createGetStyles(colors => ({
  container: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 20,
    height: 20,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  number: {
    fontSize: 13,
    color: colors['blue-default'],
  },
}));

export default PendingTx;
