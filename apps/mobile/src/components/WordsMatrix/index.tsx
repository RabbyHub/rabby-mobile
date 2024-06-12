import { AppColorsVariants } from '@/constant/theme';
import { useThemeColors } from '@/hooks/theme';
import React, { FC, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

interface Props {
  style?: StyleProp<ViewStyle>;
  words?: string[];
}
export const WordsMatrix: FC<Props> = ({ style, words = [] }) => {
  const colors = useThemeColors();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [checkedWords, setCheckedWords] = React.useState<string[]>(
    words.slice(),
  );

  React.useEffect(() => {
    setCheckedWords(words.slice());
  }, [words]);

  return (
    <View style={[styles.grid, style]}>
      {checkedWords.map((word, idx, list) => {
        const number = idx + 1;
        return (
          <View
            key={`word-item-${word}-${idx}`}
            style={[
              styles.gridItem,
              idx % 2 === 0 && styles.borderRight,
              idx < list.length - 2 && styles.borderBottom,
            ]}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{number}.</Text>
            </View>
            <Text style={styles.text}>{word}</Text>
          </View>
        );
      })}
    </View>
  );
};

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 8,
    },
    gridItem: {
      width: '50%',
      minWidth: 0,
      flexShrink: 0,

      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 64,
    },
    badge: {
      position: 'absolute',
      top: 0,
      left: 0,
      padding: 10,
    },
    badgeText: {
      color: colors['neutral-foot'],
      fontSize: 13,
      lineHeight: 16,
    },
    text: {
      textAlign: 'center',
      color: colors['neutral-title-1'],
      fontSize: 16,
      fontWeight: '500',
    },
    borderRight: {
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors['neutral-line'],
    },
    borderBottom: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors['neutral-line'],
    },
  });
