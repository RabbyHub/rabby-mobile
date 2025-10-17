import * as ContextMenu from 'zeego/context-menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { MenuTriggerProps } from 'zeego/lib/typescript/menu';
import { useTheme2024 } from '@/hooks/theme';

export interface MenuAction {
  title: string;
  titleColor?: string;
  action?: () => void;
  key: string;
  icon: ImageSourcePropType;
  disabled?: boolean;
  // like delete, text will be red
  destructive?: boolean;
  androidIconName?: string;
  androidIconColor?: string;
}

type Props = {
  menuConfig: {
    menuTitle?: string;
    menuActions: MenuAction[];
  };
  preViewBorderRadius?: number;
  children: React.ReactElement;
  triggerProps?: Omit<MenuTriggerProps, 'children'>;
} & ContextMenuContentProps;

export const ContextMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  triggerProps,
  preViewBorderRadius = 30,
}) => {
  const { colors2024 } = useTheme2024();

  return (
    <ContextMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: preViewBorderRadius,
        },
      }}>
      <ContextMenu.Trigger {...triggerProps} isAnchoredToRight>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Content
        loop={loop}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}>
        {menuConfig.menuTitle && (
          <ContextMenu.Label>{menuConfig.menuTitle}</ContextMenu.Label>
        )}
        {menuConfig.menuActions?.map(action => {
          const defaultAndroidColor = action.destructive
            ? colors2024['red-default']
            : colors2024['neutral-body'];

          return (
            <ContextMenu.Item
              androidTitleColor={action.titleColor || defaultAndroidColor}
              destructive={action.destructive}
              disabled={action.disabled}
              key={action.key}
              onSelect={action.action}>
              <ContextMenu.ItemTitle>{action.title}</ContextMenu.ItemTitle>

              {IS_ANDROID ? (
                <ContextMenu.ItemIcon
                  androidIcon={{
                    color: action.androidIconColor || defaultAndroidColor,
                  }}
                  androidIconName={action.androidIconName}
                />
              ) : (
                <ContextMenu.ItemImage source={action.icon} />
              )}
            </ContextMenu.Item>
          );
        })}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
