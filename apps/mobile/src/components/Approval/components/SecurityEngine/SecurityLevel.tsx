import React, { useMemo } from 'react';
import { Level } from '@rabby-wallet/rabby-security-engine/dist/rules';
import { SecurityEngineLevel } from '@/constant/security';
import { AppColorsVariants } from '@/constant/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    container: {
      fontWeight: '500',
      fontSize: 13,
      lineHeight: 15,
      alignItems: 'center',
      flexDirection: 'row',
    },
    iconLevel: {
      width: 16,
      height: 16,
      marginRight: 4,
    },
  });

const SecurityLevel = ({ level }: { level: Level | 'proceed' }) => {
  const currentLevel = useMemo(() => {
    return SecurityEngineLevel[level];
  }, [level]);
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <currentLevel.icon style={styles.iconLevel} />
      <Text style={{ color: currentLevel.color }}>{currentLevel.text}</Text>
    </View>
  );
};

export default SecurityLevel;
