import { MenuTriggerProps } from 'zeego/src/menu';
import * as DropdownMenu from 'zeego/src/dropdown-menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';

export interface MenuAction {
  title: string;
  action?: () => void;
  key: string;
  icon: ImageSourcePropType;
  disabled?: boolean;
  // like delete, text will be red
  destructive?: boolean;
  androidIconName?: string;
}

type Props = {
  menuConfig: {
    menuTitle?: string;
    menuActions: MenuAction[];
  };
  children: React.ReactElement;
  triggerProps?: Omit<MenuTriggerProps, 'children'>;
} & ContextMenuContentProps;

export const DropDownMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  triggerProps,
}) => {
  return (
    <DropdownMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: 30,
        },
      }}>
      <DropdownMenu.Trigger {...triggerProps} isAnchoredToRight>
        {children}
      </DropdownMenu.Trigger>

      <DropdownMenu.Content
        loop={loop}
        sideOffset={5}
        align={'end'}
        // side={{ default: 'end', right: 'start' }}
        side={'bottom'}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}>
        {menuConfig.menuTitle && (
          <DropdownMenu.Label>{menuConfig.menuTitle}</DropdownMenu.Label>
        )}
        {menuConfig.menuActions?.map(action => (
          <DropdownMenu.Item
            destructive={action.destructive}
            disabled={action.disabled}
            key={action.key}
            onSelect={action.action}>
            <DropdownMenu.ItemTitle>{action.title}</DropdownMenu.ItemTitle>

            {IS_ANDROID ? (
              <DropdownMenu.ItemIcon androidIconName={action.androidIconName} />
            ) : (
              <DropdownMenu.ItemImage source={action.icon} />
            )}
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
