import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { useMemo } from 'react';

export const CurveLoader = ({ gap }: { gap?: number }) => {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrapper: {
          paddingHorizontal: 20,
          marginTop: 10,
          gap: gap || 20,
        },
        skeleton: {
          borderRadius: 8,
        },
        text: {
          fontSize: 13,
          color: colors['neutral-foot'],
          textAlign: 'center',
        },
      }),
    [colors, gap],
  );
  return (
    <View style={styles.wrapper}>
      <Skeleton width={'100%'} height={80} style={styles.skeleton} />
      <Text style={styles.text}>Data preparing, please wait</Text>
    </View>
  );
};
