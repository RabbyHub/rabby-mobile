import React from 'react';

import { View, Text } from 'react-native';
import clsx from 'clsx';
import { SvgProps } from 'react-native-svg';
import { isValidElementType } from 'react-is';

import { makeThemeIconFromCC } from '@/hooks/makeThemeIcon';

import { RcIconRightCC } from '@/assets/icons/common';
import { ThemeColors } from '@/constant/theme';
import TouchableView from '@/components/Touchable/TouchableView';
import { useThemeColors } from '@/hooks/theme';
import { styled } from 'styled-components/native';
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
  style: React.ComponentProps<typeof View>['style'];
}>) {
  const colors = useThemeColors();

  return (
    <View style={style}>
      <Text className="text-light-neutral-title-1 dark:text-dark-neutral-title-1 font-normal text-[12]">
        {label}
      </Text>
      <View
        // className='bg-r-neutral-card-1 flex-col rounded-[6] mt-[8]'
        style={{
          backgroundColor: colors['neutral-card-1'],
          flexDirection: 'column',
          borderRadius: 6,
          marginTop: 8,
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

const BlockContainer = styled(TouchableView)`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 52px;
  padding: 16px;
`;

function BlockItem({
  label,
  icon,
  rightTextNode,
  rightNode,
  children,
  onPress,
}: React.PropsWithChildren<{
  label?: string;
  icon?: React.ReactNode | React.FC<SvgProps>;
  rightTextNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  rightNode?: React.ReactNode | ((ctx: GenerateNodeCtx) => React.ReactNode);
  onPress?: React.ComponentProps<typeof TouchableView>['onPress'];
}>) {
  children = children || (
    <Text className="font-normal text-14 text-light-neutral-title-1 dark:text-dark-neutral-title-1">
      {label}
    </Text>
  );

  const colors = useThemeColors();

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
      <View className="flex flex-row">
        {rightLabelNode}
        {rightIconNode}
      </View>
    );
  }

  rightNode = rightNode || null;

  return (
    <BlockContainer
      className={clsx(
        'flex-row justify-between items-center',
        'w-[100%] h-[52] p-[16]',
      )}
      disabled={!onPress}
      onPress={() => onPress?.()}>
      {/* left area */}
      <View className="flex-row justify-between items-center">
        {iconNode || null}
        <View className="flex-row">{children}</View>
      </View>
      {/* right area */}
      {rightNode || null}
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
