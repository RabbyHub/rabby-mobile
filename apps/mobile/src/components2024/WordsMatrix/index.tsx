import TouchableView, {
  SilentTouchableView,
} from '@/components/Touchable/TouchableView';

import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { FC, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { TouchableWithoutFeedback } from 'react-native-gesture-handler';

interface Props {
  style?: StyleProp<ViewStyle>;
  words?: string[];
  isSelectIng?: boolean;
  selectArr?: number[];
  onSelect?: (index: number) => void;
}
export const WordsMatrix: FC<Props> = ({
  style,
  words = [],
  isSelectIng = false,
  selectArr = [],
  onSelect,
}) => {
  const { styles } = useTheme2024({ getStyle });
  const [checkedWords, setCheckedWords] = React.useState<string[]>(
    words.slice(),
  );

  React.useEffect(() => {
    setCheckedWords(words.slice());
  }, [words]);

  const Component = isSelectIng ? SilentTouchableView : View;

  return (
    <View style={[styles.grid, style]}>
      {checkedWords.map((word, idx, list) => {
        const number = idx + 1;
        return (
          <Component
            style={StyleSheet.flatten([
              styles.gridItem,
              selectArr.includes(idx) && styles.selectGridItem,
            ])}
            viewStyle={StyleSheet.flatten([
              styles.gridItem,
              selectArr.includes(idx) && styles.selectGridItem,
            ])}
            onPress={() => onSelect?.(idx)}>
            {/* <View
              key={`word-item-${word}-${idx}`}
              style={StyleSheet.flatten([
                styles.gridItemInner,
                selectArr.includes(number) && styles.selectGridItem,
              ])}> */}
            {!isSelectIng && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{number}.</Text>
              </View>
            )}
            <Text style={styles.text}>{word}</Text>
            {/* </View> */}
          </Component>
        );
      })}
    </View>
  );
};

const getStyle = createGetStyles2024(({ colors2024 }) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 8,
    gap: 8,
  },
  selectGridItem: {
    borderWidth: 1,
    borderColor: colors2024['brand-default'],
    backgroundColor: colors2024['brand-light-1'],
  },
  gridItemInner: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-2'],
    minWidth: 0,
    borderRadius: 12,
    flexShrink: 0,

    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  gridItem: {
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors2024['neutral-bg-2'],
    width: '48%',
    minWidth: 0,
    borderRadius: 12,
    flexShrink: 0,

    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  badge: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 10,
  },
  badgeText: {
    color: colors2024['neutral-foot'],
    fontSize: 12,
    lineHeight: 16,
  },
  text: {
    textAlign: 'center',
    color: colors2024['neutral-body'],
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    fontSize: 16,
  },
}));
