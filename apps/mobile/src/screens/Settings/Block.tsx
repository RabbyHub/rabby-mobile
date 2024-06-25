import React from 'react';

import { View, Text } from 'react-native';
import { SvgProps } from 'react-native-svg';
import { isValidElementType } from 'react-is';
import { styled } from 'styled-components/native';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

import { RcIconRightCC } from '@/assets/icons/common';
import { ThemeColors } from '@/constant/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';

const RcIconRight = makeThemeIconFromCC(RcIconRightCC, {
  onLight: ThemeColors.light['neutral-foot'],
  onDark: ThemeColors.dark['neutral-foot'],
});

export function Block({
  label,
  style,
  children,
}: React.PropsWithChildren<{
  label: string;
  className?: string;
  style?: React.ComponentProps<typeof View>['style'];
}>) {
  const colors = useThemeColors();

  return (
    <View style={style}>
      <Text
        style={{
          fontWeight: 'normal',
          fontSize: 12,
          color: colors['neutral-title-1'],
        }}>
        {label}
      </Text>
      <View
        style={{
          borderRadius: 6,
          marginTop: 8,
          flexDirection: 'column',
          backgroundColor: colors['neutral-card-1'],
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

const BlockContainer = styled(TouchableView)<{ disableStyle?: boolean }>`
  opacity: ${props => (props.disableStyle ? 0.6 : 1)};
`;

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
  label?: string;
  icon?: React.ReactNode | React.FC<SvgProps>;
  rightTextNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  rightNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  onPress?: React.ComponentProps<typeof TouchableView>['onPress'];
  onDisabledPress?: React.ComponentProps<typeof TouchableView>['onPress'];
  visible?: boolean;
  disabled?: boolean;
}>) {
  const colors = useThemeColors();

  children = children || (
    <Text
      numberOfLines={1}
      style={{
        color: colors['neutral-title-1'],
        fontWeight: 'normal',
        fontSize: 14,
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

  const rightIconNode = <RcIconRight style={{ width: 20, height: 20 }} />;

  if (typeof rightNode === 'function') {
    rightNode = rightNode({ colors, rightIconNode });
  } else if (!rightNode) {
    let rightLabelNode: React.ReactNode = null;

    if (rightTextNode) {
      rightLabelNode =
        typeof rightTextNode === 'function'
          ? rightTextNode({ colors, rightIconNode })
          : rightTextNode;
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
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 52,
        padding: 16,
        opacity: disabled ? 0.6 : 1,
      }}
      disabled={disabled ? !onDisabledPress : !onPress}
      onPress={evt => (disabled ? onDisabledPress?.(evt) : onPress?.(evt))}>
      {/* left area */}
      <View
        style={{
          flexDirection: 'row',
          flexShrink: 1,
          alignItems: 'center',
          flex: 1,
          overflow: 'hidden',
        }}>
        <View>{iconNode || null}</View>
        <View
          style={{
            flex: 1,
          }}>
          {children}
        </View>
      </View>
      {/* right area */}
      <View
        style={{
          flexDirection: 'row',
          flexShrink: 0,
          alignItems: 'center',
        }}>
        {rightNode || null}
      </View>
    </TouchableView>
  );
}

Block.Item = BlockItem;

export type SettingConfBlock = {
  label: string;
  items: Pick<
    React.ComponentProps<typeof BlockItem>,
    'label' | 'icon' | 'onPress' | 'rightTextNode' | 'rightNode'
  >[];
};
