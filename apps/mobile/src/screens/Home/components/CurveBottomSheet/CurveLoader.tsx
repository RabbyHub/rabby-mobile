import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { useMemo } from 'react';

export const CurveLoader = () => {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: 20,
          marginTop: 10,
        },
        skeleton: {
          borderRadius: 8,
        },
        text: {
          marginTop: 20,
          fontSize: 13,
          color: colors['neutral-foot'],
          textAlign: 'center',
        },
      }),
    [colors],
  );
  return (
    <View style={styles.wrapper}>
      <Skeleton width={'100%'} height={80} style={styles.skeleton} />
      <Text style={styles.text}>Date preparing, please wait</Text>
    </View>
  );
};
