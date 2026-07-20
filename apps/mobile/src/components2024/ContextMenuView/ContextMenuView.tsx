import * as ContextMenu from '@rabby-wallet/zeego/context-menu';
import { MenuTriggerProps } from '@rabby-wallet/zeego/menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { useTheme2024 } from '@/hooks/theme';
import { useCallback, useRef } from 'react';
import { MenuComponentRef } from '@rabby-wallet/react-native-menu';
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

export interface MenuConfig {
  menuTitle?: string;
  menuActions: MenuAction[];
}

type Props = {
  menuConfig?: MenuConfig;
  /**
   * Read menu state only when the native menu opens. This avoids subscribing
   * the trigger and its ancestors to state used exclusively by menu actions.
   */
  getMenuConfig?: () => MenuConfig;
  preViewBorderRadius?: number;
  children: React.ReactElement<any>;
  triggerProps?: Omit<MenuTriggerProps, 'children'>;
  androidLongPressDuration?: number;
} & ContextMenuContentProps;

export const ContextMenuView: React.FC<Props> = ({
  children,
  menuConfig,
  getMenuConfig,
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
    .onStart(() => {
      runOnJS(androidShowMenu)();
    });

  const needUseGdOnAndroid = IS_ANDROID && triggerProps?.action === 'longPress';
  const renderMenuActions = useCallback(
    (config?: MenuConfig) =>
      config?.menuActions?.map(action => {
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
      }) || null,
    [colors2024],
  );
  const getDynamicMenuChildren = useCallback(() => {
    const config = getMenuConfig?.();
    return (
      <>
        {config?.menuTitle ? (
          <ContextMenu.Label>{config.menuTitle}</ContextMenu.Label>
        ) : null}
        {renderMenuActions(config)}
      </>
    );
  }, [getMenuConfig, renderMenuActions]);

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
        getChildren={getMenuConfig ? getDynamicMenuChildren : undefined}
        loop={loop}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}>
        {menuConfig?.menuTitle && (
          <ContextMenu.Label>{menuConfig.menuTitle}</ContextMenu.Label>
        )}
        {getMenuConfig ? null : renderMenuActions(menuConfig)}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};
