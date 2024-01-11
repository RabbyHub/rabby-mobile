import { StyleSheet, View, ViewStyle } from 'react-native';
import React, { ReactNode } from 'react';
import IconQuestionMark from '@/assets/icons/sign/tx/question-mark.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    tableWrapper: {
      borderWidth: 0.5,
      borderColor: colors['neutral-line'], // Default color if --r-neutral-line is not available
      borderRadius: 8,
    },
    colWrapper: {
      display: 'flex',
      borderBottomWidth: 0.5,
      borderBottomColor: colors['neutral-line'],
      alignItems: 'stretch',
      flexDirection: 'row',
      width: '100%',
    },
    firstChild: {
      borderTopLeftRadius: 8,
    },
    lastChild: {
      borderBottomWidth: 0,
      borderBottomLeftRadius: 8,
    },
    row: {}, // Assuming .row has its own styles, you can add them here
    rowWrapper: {
      position: 'relative',
      paddingVertical: 13,
      paddingHorizontal: 10,
      fontWeight: '500',
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'], // Default color if --r-neutral-title-1 is not available
    },
    notTitle: {
      flex: 1,
      width: 190,
    },
    hasDescList: {
      paddingRight: 0,
    },
    title: {
      fontSize: 15,
      lineHeight: 18,
      color: colors['neutral-title-1'], // Default color if --r-neutral-title-1 is not available
      borderRightWidth: 0.5,
      borderRightColor: colors['neutral-line'], // Default color if --r-neutral-line is not available
      width: 123,
      flexShrink: 0,
      backgroundColor: colors['neutral-card-3'], // Default color if --r-neutral-card-3 is not available
    },
    hasBottomBorder: {
      flex: 1,
      borderBottomWidth: 1,
      borderBottomColor: '#e5e9ef',
    },
    lastChildNoBorder: {
      borderBottomWidth: 0,
    },
    descList: {
      fontSize: 13,
      lineHeight: 15,
      color: colors['neutral-body'], // Default color if --r-neutral-body is not available
    },
    descListItem: {
      paddingLeft: 10,
      marginBottom: 8,
      paddingRight: 10,
      position: 'relative',
    },
    descBullet: {
      content: '',
      position: 'absolute',
      left: 3,
      width: 3,
      height: 3,
      backgroundColor: colors['neutral-body'], // Default color if --r-neutral-body is not available
      borderRadius: 100,
      top: 6,
    },
    descListFirst: {
      marginTop: 8,
    },
    descListLast: {
      marginBottom: 0,
    },
  });

const Table = ({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return <View style={{ ...styles.tableWrapper, ...style }}>{children}</View>;
};

const Col = ({ children }: { children: ReactNode }) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View style={styles.colWrapper} className="col">
      {children}
    </View>
  );
};

const Row = ({
  children,
  isTitle = false,
  tip,
  style,
}: {
  children: ReactNode;
  isTitle?: boolean;
  tip?: string;
  style?: ViewStyle;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View
      style={{
        ...(isTitle ? styles.title : styles.notTitle),
        ...styles.rowWrapper,
        ...style,
      }}
      className="relative">
      {children}
      {tip && <IconQuestionMark className="icon icon-tip ml-6 inline" />}
    </View>
  );
};

export { Table, Col, Row };
