import * as ContextMenu from 'zeego/src/context-menu';
import { MenuItemCommonProps } from 'zeego/src/menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';

export interface MenuAction {
  title: string;
  textColor?: string;
  disabled?: boolean;
  onSelect?: () => void;
  key: string;
  iosIconSource: ImageSourcePropType;
  iosIcon?: MenuItemCommonProps['ios'];
  // androidIcon?: MenuItemCommonProps['androidIcon'];
  androidIconName?: string;
}

type Props = {
  menuConfig: {
    iosMenuTitle?: string;
    menuActions: MenuAction[];
  };
  children: React.ReactElement;
} & ContextMenuContentProps;

export const ContextMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
}) => {
  return (
    <ContextMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: 30,
        },
      }}>
      <ContextMenu.Trigger>{children}</ContextMenu.Trigger>

      <ContextMenu.Content
        loop={loop}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}>
        {menuConfig.iosMenuTitle && (
          <ContextMenu.Label>{menuConfig.iosMenuTitle}</ContextMenu.Label>
        )}
        {menuConfig.menuActions?.map((action, idx) => (
          <ContextMenu.Item
            key={`${action.key}-${idx}`}
            onSelect={action.onSelect}
            disabled={action.disabled || !action.onSelect}
            // @ts-expect-error FIXME: we need check here
            textColor={action.textColor}>
            <ContextMenu.ItemTitle>{action.title}</ContextMenu.ItemTitle>
            <ContextMenu.ItemImage
              source={action.iosIconSource}
              ios={action.iosIcon}
            />
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
