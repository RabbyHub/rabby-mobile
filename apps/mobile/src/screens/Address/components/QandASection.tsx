import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    questionText: {
      color: colors['neutral-title1'],
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 18,
    },
    answerText: {
      color: colors['neutral-body'],
      fontSize: 13,
      lineHeight: 16,
    },
    wrapper: {
      gap: 6,
    },
  });

interface Props {
  question: string;
  answer: string;
  style?: StyleProp<ViewStyle>;
}

export const QandASection: React.FC<Props> = ({ question, answer, style }) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={StyleSheet.flatten([styles.wrapper, style])}>
      <Text style={styles.questionText}>{question}</Text>
      <Text style={styles.answerText}>{answer}</Text>
    </View>
  );
};
