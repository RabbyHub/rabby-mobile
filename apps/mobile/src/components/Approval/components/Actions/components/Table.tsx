import { StyleSheet, View, ViewStyle } from 'react-native';
import React, { ReactNode } from 'react';
import IconQuestionMark from '@/assets/icons/sign/tx/question-mark.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Tip } from '@/components/Tip';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    colWrapper: {
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingVertical: 12,
    },
    hasTip: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    rowWrapper: {
      position: 'relative',
      fontWeight: '500',
      alignItems: 'flex-start',
      whiteSpace: 'nowrap',
    },
    notTitle: {
      textAlign: 'right',
      justifyContent: 'flex-end',
    },
    title: {
      flex: 1,
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
  const colors = useThemeColors();
  const styles = getStyles(colors);
  let newChildren = children as any;

  // if (Array.isArray(children)) {
  //   const firstChild = children[0];
  //   const lastChild = children[children.length - 1];

  //   const modifiedFirstChild = firstChild
  //     ? React.cloneElement(firstChild, {
  //         first: true,
  //         key: 'col-clone-first',
  //       })
  //     : firstChild;
  //   const modifiedLastChild = lastChild
  //     ? React.cloneElement(lastChild, {
  //         last: true,
  //         key: 'col-clone-last',
  //       })
  //     : lastChild;

  //   newChildren = [
  //     modifiedFirstChild,
  //     ...children.slice(1, children.length - 1),
  //     modifiedLastChild,
  //   ];
  // }

  return <View style={{ ...style }}>{newChildren}</View>;
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

  // if (Array.isArray(children)) {
  //   const firstChild = children[0];

  //   const modifiedFirstChild = firstChild
  //     ? React.cloneElement(firstChild, {
  //         first,
  //         last,
  //         key: 'row-clone',
  //       })
  //     : firstChild;

  //   newChildren = [modifiedFirstChild, ...children.slice(1)];
  // }

  return (
    <View
      style={{
        ...styles.colWrapper,
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
      style={StyleSheet.flatten([
        {
          ...(isTitle ? styles.title : styles.notTitle),
          ...styles.rowWrapper,
          ...(tip ? styles.hasTip : {}),
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
          />
        </Tip>
      )}
    </View>
  );
};

export { Table, Col, Row };
