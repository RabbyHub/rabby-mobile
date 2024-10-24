import {
  Dimensions,
  LayoutRectangle,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import React, { ReactNode } from 'react';
import IconQuestionMark from '@/assets/icons/sign/tx/question-mark.svg';
import { useThemeColors } from '@/hooks/theme';
import { AppColorsVariants } from '@/constant/theme';
import { Tip } from '@/components/Tip';
import IconTableArrow from '@/assets/icons/sign/table-arrow.svg';

const getStyles = (colors: AppColorsVariants) =>
  StyleSheet.create({
    colWrapper: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    hasTip: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    rowWrapper: {
      position: 'relative',
      // whiteSpace: 'nowrap',
    },
    notTitle: {
      textAlign: 'right',
      justifyContent: 'flex-end',
    },
    title: {
      flex: 1,
      flexShrink: 0,
    },
    table: {
      borderRadius: 6,
      backgroundColor: colors['neutral-card3'],
      padding: 12,
      rowGap: 12,
      flexDirection: 'column',
      marginBottom: 12,
    },
  });

const WIDTH = Dimensions.get('window').width;
export const SubTable = ({
  children,
  style,
  target,
}: {
  children: ReactNode;
  style?: ViewStyle;
  target?: React.RefObject<View>;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);
  const [left, setLeft] = React.useState(WIDTH - 100);
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (target?.current) {
      target.current.measure((x, y, w, h, pX, pY) => {
        const num = pX + w / 2 - 30;
        if (!isNaN(num)) {
          setLeft(num);
        }
      });
    }
  }, [target]);

  const handleLayout = (layout: LayoutRectangle) => {
    // padding * 2 + marginBottom = 36
    setVisible(layout.height > 36);
  };

  if (!visible) {
    return null;
  }

  return (
    <View
      onLayout={event => handleLayout(event.nativeEvent.layout)}
      style={StyleSheet.flatten({
        position: 'relative',
        ...style,
      })}>
      <View style={styles.table}>{children}</View>
      <IconTableArrow
        color={colors['neutral-card3']}
        style={StyleSheet.flatten({
          position: 'absolute',
          left,
          top: -8,
        })}
      />
    </View>
  );
};

export const SubCol = ({
  children,
  style,
  nested,
}: {
  children: ReactNode;
  style?: ViewStyle;
  nested?: boolean;
}) => {
  const colors = useThemeColors();
  const styles = getStyles(colors);

  return (
    <View
      style={{
        ...styles.colWrapper,
        ...(nested ? { marginTop: -6 } : {}),
        ...(style || {}),
      }}>
      {children}
    </View>
  );
};

export const SubRow = ({
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
  const styles = getStyles(colors);
  return (
    <View
      style={StyleSheet.flatten([
        {
          ...(isTitle ? styles.title : styles.notTitle),
          ...styles.rowWrapper,
          ...(tip ? styles.hasTip : {}),
          ...(itemsCenter ? { alignItems: 'center' } : {}),
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
