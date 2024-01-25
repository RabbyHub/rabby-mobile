import { useThemeColors } from '@/hooks/theme';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

const keywords = ['Swap', 'Dex', 'Aggregator', 'Stake'];

export const SearchSuggest = ({
  onPress,
  style,
}: {
  style?: StyleProp<ViewStyle>;
  onPress?: (keyword: string) => void;
}) => {
  const colors = useThemeColors();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.title}>Favorite</Text>
      <View style={styles.list}>
        {keywords.map(item => {
          return (
            <TouchableOpacity
              key={item}
              style={styles.item}
              onPress={() => {
                onPress?.(item);
              }}>
              <Text style={styles.text}>{item}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const getStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    container: {
      padding: 20,
    },
    title: {
      fontSize: 12,
      lineHeight: 14,
      marginBottom: 8,
      color: colors['neutral-foot'],
    },
    list: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    item: {
      backgroundColor: colors['neutral-card-1'],
      borderRadius: 4,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    text: {
      fontSize: 14,
      lineHeight: 17,
      color: colors['neutral-body'],
    },
  });
