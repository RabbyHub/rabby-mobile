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
    hasTip: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
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
      borderBottomWidth: 0.5,
      borderBottomColor: colors['neutral-line'],
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
  let newChildren = children as any;

  if (Array.isArray(children)) {
    const firstChild = children[0];
    const lastChild = children[children.length - 1];

    const modifiedFirstChild = firstChild
      ? React.cloneElement(firstChild, {
          first: true,
        })
      : firstChild;
    const modifiedLastChild = lastChild
      ? React.cloneElement(lastChild, {
          last: true,
        })
      : lastChild;

    newChildren = [
      modifiedFirstChild,
      ...children.slice(1, children.length - 1),
      modifiedLastChild,
    ];
  }

  return (
    <View style={{ ...styles.tableWrapper, ...style }}>{newChildren}</View>
  );
};

const Col = ({
  children,
  style,
  last,
  first,
}: {
  children: ReactNode;
  style?: ViewStyle;
  last?: boolean;
  first?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  let newChildren = children as any;

  if (Array.isArray(children)) {
    const firstChild = children[0];

    const modifiedFirstChild = firstChild
      ? React.cloneElement(firstChild, {
          first,
          last,
        })
      : firstChild;

    newChildren = [modifiedFirstChild, ...children.slice(1)];
  }

  return (
    <View
      style={{
        ...styles.colWrapper,
        ...(last ? styles.lastChildNoBorder : {}),
        ...(style || {}),
      }}>
      {newChildren}
    </View>
  );
};

const Row = ({
  children,
  isTitle = false,
  hasBottomBorder = false,
  tip,
  style,
  first,
  last,
}: {
  children: ReactNode;
  hasBottomBorder?: Boolean;
  isTitle?: boolean;
  tip?: string;
  style?: ViewStyle;
  last?: boolean;
  first?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  return (
    <View
      style={{
        ...(isTitle ? styles.title : styles.notTitle),
        ...styles.rowWrapper,
        ...(hasBottomBorder ? styles.hasBottomBorder : {}),
        ...(tip ? styles.hasTip : {}),
        ...(first ? styles.firstChild : {}),
        ...(last ? styles.lastChild : {}),
        ...style,
      }}>
      {children}
      {tip && (
        <IconQuestionMark
          style={{
            marginLeft: 6,
          }}
        />
      )}
    </View>
  );
};

export { Table, Col, Row };
