import * as ContextMenu from 'zeego/context-menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';

export interface MenuAction {
  title: string;
  action?: () => void;
  key: string;
  icon: ImageSourcePropType;
}

type Props = {
  menuConfig: {
    menuTitle?: string;
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
        {menuConfig.menuTitle && (
          <ContextMenu.Label>{menuConfig.menuTitle}</ContextMenu.Label>
        )}
        {menuConfig.menuActions?.map(action => (
          <ContextMenu.Item key={action.key} onSelect={action.action}>
            <ContextMenu.ItemTitle>{action.title}</ContextMenu.ItemTitle>
            <ContextMenu.ItemImage source={action.icon} />
          </ContextMenu.Item>
        ))}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
