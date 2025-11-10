import * as DropdownMenu from 'zeego/src/dropdown-menu';
import { MenuItemCommonProps } from 'zeego/src/menu';
import type { DropdownMenuContentProps } from '@radix-ui/react-dropdown-menu';
import { ImageSourcePropType, Pressable, Text } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';

export interface MenuAction {
  title: string;
  textColor?: string;
  disabled?: boolean;
  onSelect?: () => void;
  key: string;
  iosIconSource?: ImageSourcePropType;
  iosIcon?: MenuItemCommonProps['ios'];
  androidIconName?: string;
}

type Props = {
  menuConfig: {
    iosMenuTitle?: string;
    menuActions: MenuAction[];
  };
  children: React.ReactElement;
} & DropdownMenuContentProps;

export const DropdownMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  side = 'top',
}) => {
  return (
    <DropdownMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: 30,
        },
      }}>
      <DropdownMenu.Trigger>
        <Pressable hitSlop={5}>{children}</Pressable>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        side={side}
        sideOffset={-5}
        align={'center'}
        loop={loop}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}
        style={{
          borderRadius: 30,
        }}>
        {menuConfig.iosMenuTitle && (
          <DropdownMenu.Label>{menuConfig.iosMenuTitle}</DropdownMenu.Label>
        )}
        {menuConfig.menuActions?.map((action, idx) => {
          return (
            <DropdownMenu.Item
              key={`${action.key}-${idx}`}
              onSelect={action.onSelect}
              disabled={action.disabled || !action.onSelect}
              // @ts-expect-error FIXME: we need check here
              textColor={action.textColor}>
              <DropdownMenu.ItemTitle>{action.title}</DropdownMenu.ItemTitle>
              {IS_ANDROID && action.androidIconName ? (
                <DropdownMenu.ItemIcon
                  androidIconName={action.androidIconName}
                  // androidIcon={action.androidIcon}
                />
              ) : (
                !!action.iosIconSource && (
                  <DropdownMenu.ItemImage
                    source={action.iosIconSource}
                    ios={action.iosIcon}
                  />
                )
              )}
            </DropdownMenu.Item>
          );
        })}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
