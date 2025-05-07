/* eslint-disable react-native/no-inline-styles */
import React from 'react';

import { View, Text } from 'react-native';
import { SvgProps } from 'react-native-svg';
import { isValidElementType } from 'react-is';
import { default as RcIconRight } from '@/assets/icons/settings/icon-arrow-right.svg';
import TouchableView from '@/components/Touchable/TouchableView';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';

export function Block({
  label,
  style,
  children,
}: React.PropsWithChildren<{
  label: string;
  className?: string;
  style?: React.ComponentProps<typeof View>['style'];
}>) {
  const { colors2024, isLight } = useTheme2024();

  return (
    <View style={style}>
      <Text
        style={{
          fontWeight: 'normal',
          fontSize: 16,
          color: colors2024['neutral-secondary'],
          fontFamily: 'SF Pro Rounded',
          paddingLeft: 12,
        }}>
        {label}
      </Text>
      <View
        style={{
          borderRadius: 24,
          marginTop: 8,
          flexDirection: 'column',
          backgroundColor: isLight
            ? colors2024['neutral-bg-1']
            : colors2024['neutral-bg-2'],
        }}>
        {children}
      </View>
    </View>
  );
}

type GenerateNodeCtx = {
  colors: Record<string, string>;
  rightIconNode: React.ReactNode;
};

function BlockItem({
  label,
  icon,
  rightTextNode,
  rightNode,
  children,
  onPress,
  onDisabledPress,
  visible = true,
  disabled = false,
}: React.PropsWithChildren<{
  label?: React.ReactNode;
  icon?: React.ReactNode | React.FC<SvgProps>;
  rightTextNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  rightNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  onPress?: React.ComponentProps<typeof TouchableView>['onPress'];
  onDisabledPress?: React.ComponentProps<typeof TouchableView>['onPress'];
  visible?: boolean;
  disabled?: boolean;
}>) {
  const { colors2024: colors, styles } = useTheme2024({
    getStyle: getBlockItemStyles,
  });

  children = children || (
    <Text
      numberOfLines={1}
      style={{
        color: colors['neutral-body'],
        fontWeight: '700',
        fontSize: 16,
        fontFamily: 'SF Pro Rounded',
      }}>
      {label}
    </Text>
  );

  const MaybeIconEle = icon as React.FC<SvgProps>;

  const iconNode = isValidElementType(icon) ? (
    <View style={{ marginRight: 12 }}>
      <MaybeIconEle style={{ width: 20, height: 20 }} />
    </View>
  ) : (
    (icon as React.ReactNode)
  );

  const rightIconNode = (
    <RcIconRight style={{ width: 16, height: 16, marginLeft: 4 }} />
  );

  if (typeof rightNode === 'function') {
    rightNode = rightNode({ colors, rightIconNode });
  } else if (!rightNode) {
    let rightLabelNode: React.ReactNode = null;

    if (rightTextNode) {
      if (typeof rightTextNode === 'string') {
        rightLabelNode = (
          <Text style={styles.defaultRightText}>{rightTextNode}</Text>
        );
      } else {
        rightLabelNode =
          typeof rightTextNode === 'function'
            ? rightTextNode({ colors, rightIconNode })
            : rightTextNode;
      }
    }

    rightNode = (
      <>
        {rightLabelNode}
        {rightIconNode}
      </>
    );
  }

  if (!visible) {
    return null;
  }

  return (
    <TouchableView
      // disabled={disabled}
      style={[styles.container, { opacity: disabled ? 0.6 : 1 }]}
      disabled={disabled ? !onDisabledPress : !onPress}
      onPress={evt => (disabled ? onDisabledPress?.(evt) : onPress?.(evt))}>
      {/* left area */}
      <View style={styles.leftArea}>
        <View>{iconNode || null}</View>
        <View style={styles.leftTextArea}>{children}</View>
      </View>
      {/* right area */}
      <View style={styles.rightArea}>{rightNode || null}</View>
    </TouchableView>
  );
}

const getBlockItemStyles = createGetStyles2024(colors => {
  return {
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      height: 52,
      paddingVertical: 0,
      paddingHorizontal: 16,
      // ...makeDebugBorder('yellow'),
    },
    leftArea: {
      flexDirection: 'row',
      flexShrink: 1,
      alignItems: 'center',
      flex: 1,
      overflow: 'hidden',
      height: '100%',
    },
    leftTextArea: {
      flex: 1,
      // width: '100%',
      alignItems: 'flex-start',
      // ...makeDebugBorder(),
    },
    rightArea: {
      flexDirection: 'row',
      flexShrink: 0,
      alignItems: 'center',
      height: '100%',
      // ...makeDebugBorder(),
    },
    defaultRightText: {
      color: colors['neutral-title-1'],
      fontWeight: 'normal',
      fontSize: 14,
    },
  };
});

Block.Item = BlockItem;

export type SettingConfBlock = {
  label: string;
  items: Pick<
    React.ComponentProps<typeof BlockItem>,
    'label' | 'icon' | 'onPress' | 'rightTextNode' | 'rightNode'
  >[];
};
