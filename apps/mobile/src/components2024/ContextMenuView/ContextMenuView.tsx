import * as ContextMenu from 'zeego/src/context-menu';
import { MenuTriggerProps } from 'zeego/src/menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { MenuComponentRef } from '@react-native-menu/menu';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
// import { touchedFeedback } from '@/utils/touch';

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
  androidLongPressDuration?: number;
} & ContextMenuContentProps;

export const ContextMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  triggerProps,
  preViewBorderRadius = 30,
  androidLongPressDuration = 350,
}) => {
  const { colors2024 } = useTheme2024();

  const androidMenuViewRef = useRef<MenuComponentRef>(null);

  const androidShowMenu = useCallback(() => {
    // touchedFeedback();
    androidMenuViewRef.current?.show();
  }, []);

  const longPressGesture = Gesture.LongPress()
    .minDuration(androidLongPressDuration)
    .runOnJS(false)
    .onStart(e => {
      runOnJS(androidShowMenu)();
    });

  const needUseGdOnAndroid = IS_ANDROID && triggerProps?.action === 'longPress';

  return (
    <ContextMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: preViewBorderRadius,
        },
      }}
      androidMenuViewRef={androidMenuViewRef}>
      <ContextMenu.Trigger
        action="longPress"
        {...triggerProps}
        isAnchoredToRight
        {...(needUseGdOnAndroid && {
          androidSuppressNativeLongPress: true,
          action: 'longPress',
        })}>
        {needUseGdOnAndroid ? (
          <GestureDetector gesture={longPressGesture}>
            {children}
          </GestureDetector>
        ) : (
          children
        )}
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
