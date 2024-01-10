import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import React from 'react';
import { View } from 'react-native';
import { getStyles } from './styles';

export const GasSelectorSkeleton = () => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.gasSelector}>
      <View>
        <View>
          <Skeleton style={{ width: 120, height: 18 }} />
        </View>
        <View style={styles.cardGroup}>
          {Array(4)
            .fill(0)
            .map((_e, i) => (
              <Skeleton key={i} style={{ width: 76, height: 52 }} />
            ))}
        </View>
      </View>
    </View>
  );
};
