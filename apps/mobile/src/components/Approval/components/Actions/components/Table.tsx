import { StyleSheet, View, ViewStyle } from 'react-native';
import React, { ReactNode } from 'react';
import IconQuestionMark from '@/assets2024/icons/common/help-cc.svg';
import { useTheme2024, useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Tip } from '@/components/Tip';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    colWrapper: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 11,
      gap: 12,
    },
    hasTip: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
    },

    rowWrapper: {
      position: 'relative',
      fontWeight: '500',
    },
    notTitle: {
      textAlign: 'right',
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      alignItems: 'flex-end',
    },
    title: {
      flex: 0,
      flexShrink: 0,
    },
  });

const Table = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => {
  return <View style={{ ...style }}>{children}</View>;
};

const Col = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View
      style={{
        ...styles.colWrapper,
        ...(style || {}),
      }}>
      {children}
    </View>
  );
};

const Row = ({
  children,
  isTitle = false,
  tip,
  style,
  itemsCenter,
}: {
  children: ReactNode;
  isTitle?: boolean;
  tip?: string;
  style?: ViewStyle;
  itemsCenter?: boolean;
}) => {
  const colors = useThemeColors();
  const { colors2024 } = useTheme2024();

  const styles = getStyles(colors);
  return (
    <View
      style={StyleSheet.flatten([
        {
          ...styles.rowWrapper,
          ...(isTitle ? styles.title : styles.notTitle),
          ...(tip ? styles.hasTip : {}),
          ...(itemsCenter ? { justifyContent: 'center' } : {}),
        },
        style,
      ])}>
      {children}
      {tip && (
        <Tip placement="top" content={tip}>
          <IconQuestionMark
            style={StyleSheet.flatten({
              marginLeft: 6,
            })}
            color={colors2024['neutral-info']}
          />
        </Tip>
      )}
    </View>
  );
};

export { Table, Col, Row };
