import React from 'react';
import { SvgProps } from 'react-native-svg';
import { Signal } from '@/components/Signal';
import { StyleSheet, Text, View } from 'react-native';
import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';

export interface Props {
  icon: React.FC<SvgProps>;
  signal?: 'CONNECTED' | 'DISCONNECTED';
  customSignal?: React.ReactNode;
  tip?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      gap: 6,
      flexDirection: 'row',
      alignItems: 'flex-start',
      position: 'relative',
    },
    iconWrapper: {
      position: 'relative',
    },
    icon: {
      width: 20,
      height: 20,
    },
    text: {
      fontSize: 13,
      lineHeight: 20,
      color: colors['neutral-foot'],
    },
  });

export const CommonAccount: React.FC<Props> = ({
  icon,
  tip,
  signal,
  customSignal,
  children,
  footer,
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const bgColor = React.useMemo(() => {
    switch (signal) {
      case 'DISCONNECTED':
        return 'gray';

      default:
      case 'CONNECTED':
        return 'green';
    }
  }, [signal]);

  const Icon = icon;

  return (
    <View>
      <View style={styles.wrapper}>
        <View style={styles.iconWrapper}>
          <View style={styles.icon}>
            <Icon width={'100%'} height={'100%'} />
          </View>
          <View>{customSignal}</View>
          {signal && <Signal isBadge color={bgColor} />}
        </View>
        {typeof tip === 'string' ? <Text style={styles.text}>{tip}</Text> : tip}
        {children}
      </View>
      {footer}
    </View>
  );
};
