import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import { Skeleton } from '@rneui/themed';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export const Linear = () => {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <LinearGradient
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.linear}
      colors={[
        'rgba(190,190,190,.2)',
        'rgba(129,129,129,.24)',
        'rgba(190,190,190,.2)',
      ]}
    />
  );
};

export const SkeletonCard = () => {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View style={styles.card}>
      <Skeleton
        animation="wave"
        width={161}
        height={14}
        LinearGradientComponent={Linear}
        style={[styles.skeleton, styles.skeleton1]}
      />
      <Skeleton
        LinearGradientComponent={Linear}
        animation="wave"
        width={225}
        height={18}
        style={[styles.skeleton, styles.skeleton2]}
      />
      <Skeleton
        LinearGradientComponent={Linear}
        style={[styles.skeleton]}
        animation="wave"
        width={161}
        height={14}
      />
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors['neutral-card1'],
      borderRadius: 6,
      paddingTop: 8,
      paddingHorizontal: 14,
      paddingBottom: 16,
      flexDirection: 'column',
      marginBottom: 12,
    },
    skeleton: {
      backgroundColor: 'rgba(190,190,190,0.2)',
    },
    skeleton1: {
      marginBottom: 12,
    },
    skeleton2: {
      marginBottom: 16,
    },
    linear: {
      height: '100%',
    },
  });
