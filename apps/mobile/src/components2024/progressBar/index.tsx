import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import React, { ReactNode } from 'react';
import { StyleSheet, View, PressableProps, Text } from 'react-native';

interface ProgressBarProps extends PressableProps {
  amount: number;
  currentCount: number;
}

export const ProgressBar = (props: ProgressBarProps) => {
  const { amount, currentCount } = props;

  const { styles } = useTheme2024({ getStyle: getStyles });

  return (
    <View style={StyleSheet.flatten([styles.container])}>
      {new Array(amount).fill(null).map((_, index) => {
        const key = `block-${index}`;
        return (
          <View
            key={key}
            style={[
              styles.block,
              index + 1 === currentCount
                ? styles.currentBlock
                : index + 1 < currentCount
                ? styles.hasDoneBlock
                : styles.todoBlock,
            ]}
          />
        );
      })}
      <Text style={[styles.text]}>{`${currentCount}/${amount}`}</Text>
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 26,
  },
  textContainer: {
    marginLeft: 12,
  },
  text: {
    color: ctx.colors2024['brand-default'],
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'SF Pro Rounded',
    marginLeft: 12,
  },
  block: {
    display: 'flex',
    borderRadius: 105,
    flex: 1,
    height: 8,
    marginRight: 8,
  },
  currentBlock: {
    backgroundColor: ctx.colors2024['brand-light-4'],
  },
  hasDoneBlock: {
    backgroundColor: ctx.colors2024['brand-default'],
  },
  todoBlock: {
    backgroundColor: ctx.colors2024['neutral-bg-4'],
  },
}));
