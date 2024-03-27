import { useThemeStyles } from '@/hooks/theme';
import { createGetStyles } from '@/utils/styles';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native';
import { View } from 'react-native';

export function SimulateUnderline(props: RNViewProps) {
  const { styles } = useThemeStyles(getStyles);

  return (
    <View {...props} style={[styles.outer, props.style]}>
      <View style={styles.inner} />
    </View>
  );
}

const getStyles = createGetStyles(colors => {
  return {
    outer: {
      height: 1,
      width: '100%',
      borderRadius: 1,
      borderWidth: 1,
      borderColor: colors['red-default'],
      borderStyle: 'dashed',
      zIndex: 0,
    },
    inner: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: '100%',
      height: 1,
      backgroundColor: 'white',
      zIndex: 1,
    },
  };
});

export function TailedTitle({
  text,
  ...props
}: { text?: string } & RNViewProps) {
  const { styles } = useThemeStyles(getTailStyles);
  return (
    <View {...props} style={[props.style, styles.tipContainer]}>
      <View style={styles.tipLine} />
      <Text style={styles.tip}>{text || null}</Text>
      <View style={styles.tipLine} />
    </View>
  );
}

const getTailStyles = createGetStyles(colors => {
  return {
    tipContainer: {
      position: 'relative',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    tip: {
      textAlign: 'center',
      color: colors['neutral-foot'],
      fontSize: 11,
      paddingHorizontal: 10,
    },
    tipLine: {
      width: 'auto',
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors['neutral-line'],
    },
  };
});
