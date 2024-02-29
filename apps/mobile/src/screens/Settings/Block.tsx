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
import { WindView } from '@/components/NativeWind';

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
        className="font-normal text-[12]"
        style={{
          color: colors['neutral-title-1'],
        }}>
        {label}
      </Text>
      <WindView
        className="rounded-[6px] mt-[8] flex-col"
        style={{
          backgroundColor: colors['neutral-card-1'],
        }}>
        {children}
      </WindView>
    </View>
  );
}

type GenerateNodeCtx = {
  colors: Record<string, string>;
  rightIconNode: React.ReactNode;
};

const BlockContainer = styled(TouchableView)<{ disableStyle?: boolean }>`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 52px;
  padding: 16px;
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
      className="font-normal text-[14] "
      numberOfLines={1}
      style={{
        color: colors['neutral-title-1'],
      }}>
      {label}
    </Text>
  );

  const MaybeIconEle = icon as React.FC<SvgProps>;

  const iconNode = isValidElementType(icon) ? (
    <View className="mr-[12]">
      <MaybeIconEle className="w-[20] h-[20]" />
    </View>
  ) : (
    (icon as React.ReactNode)
  );

  const rightIconNode = <RcIconRight className="w-[20] h-[20]" />;

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
    <BlockContainer
      disableStyle={disabled}
      disabled={disabled ? !onDisabledPress : !onPress}
      onPress={() => (disabled ? onDisabledPress?.() : onPress?.())}>
      {/* left area */}
      <WindView
        className="flex-row flex-shrink-1 items-center"
        style={{
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
      </WindView>
      {/* right area */}
      <WindView className="flex-row flex-shrink-0 items-center">
        {rightNode || null}
      </WindView>
    </BlockContainer>
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
