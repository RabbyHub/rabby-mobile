import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// import styled from 'styled-components';

// const DotsStyled = styled.span`
//   span {
//     display: inline-block;
//   }

//   .dot1 {
//     animation: jump 1.5s infinite -0.2s;
//   }

//   .dot2 {
//     animation: jump 1.5s infinite;
//   }

//   .dot3 {
//     animation: jump 1.5s infinite 0.2s;
//   }

//   @keyframes jump {
//     30% {
//       transform: translateY(0);
//     }
//     50% {
//       transform: translateY(-5px);
//     }

//     70% {
//       transform: translateY(2px);
//     }
//   }
// `;

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: 'row',
    },
    dot: {
      fontSize: 20,
      fontWeight: '500',
      lineHeight: 24,
    },
  });

export const Dots: React.FC<{
  color?: string;
}> = ({ color }) => {
  // TODO: jump dots animation
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.wrapper}>
      <Text
        style={[
          styles.dot,
          {
            color: colors[color],
          },
        ]}>
        .
      </Text>
      <Text
        style={[
          styles.dot,
          {
            color: colors[color],
          },
        ]}>
        .
      </Text>
      <Text
        style={[
          styles.dot,
          {
            color: colors[color],
          },
        ]}>
        .
      </Text>
    </View>
  );
};
