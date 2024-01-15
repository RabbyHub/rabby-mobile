import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const getStyle = (colors: AppColorsVariants) =>
  StyleSheet.create({
    descItem: {
      position: 'relative',
      paddingRight: 0,
      paddingLeft: 10,
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
    },
    ball: {
      position: 'absolute',
      left: 3,
      width: 3,
      height: 3,
      backgroundColor: colors['neutral-body'],
      borderRadius: 3,
      top: '50%',
      marginTop: -1.5,
    },
  });

const DescItem = ({ children }: { children: ReactNode }) => {
  const colors = useThemeColors();
  const styles = getStyle(colors);
  return (
    <View style={styles.descItem}>
      <View style={styles.ball} />
      <View>{children}</View>
    </View>
  );
};

export default DescItem;
