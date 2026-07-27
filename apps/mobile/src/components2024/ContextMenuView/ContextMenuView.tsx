// Context menus are centralized here so app code cannot bypass open-time
// action snapshots or the platform-specific native menu fixes.
// eslint-disable-next-line no-restricted-imports
import * as ContextMenu from '@rabby-wallet/zeego/context-menu';
import { MenuTriggerProps } from '@rabby-wallet/zeego/menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType, Platform } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { apisTheme } from '@/hooks/theme';
import { useCallback, useRef } from 'react';
// eslint-disable-next-line no-restricted-imports
import { MenuComponentRef } from '@rabby-wallet/react-native-menu';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
// import { touchedFeedback } from '@/utils/touch';

const IS_IOS_27_OR_ABOVE =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 27;

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
  /**
   * Read menu state only when the native menu opens. This avoids subscribing
   * the trigger and its ancestors to state used exclusively by menu actions.
   */
  getMenuConfig: () => MenuConfig;
  preViewBorderRadius?: number;
  children: React.ReactElement<any>;
  triggerProps?: Omit<MenuTriggerProps, 'children'>;
  androidLongPressDuration?: number;
} & ContextMenuContentProps;

function renderMenuActions(config: MenuConfig) {
  const { colors2024 } = apisTheme.getColors2024();
  return config.menuActions.map(action => {
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
  });
}

export const ContextMenuView: React.FC<Props> = ({
  children,
  getMenuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  triggerProps,
  preViewBorderRadius = 30,
  androidLongPressDuration = 350,
}) => {
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
  const getDynamicMenuChildren = useCallback(() => {
    const config = getMenuConfig();
    return (
      <>
        {config.menuTitle ? (
          <ContextMenu.Label>{config.menuTitle}</ContextMenu.Label>
        ) : null}
        {renderMenuActions(config)}
      </>
    );
  }, [getMenuConfig]);

  const previewTheme = IS_IOS_27_OR_ABOVE
    ? apisTheme.getColors2024()
    : undefined;

  return (
    <ContextMenu.Root
      __unsafeIosProps={{
        previewConfig: {
          borderRadius: preViewBorderRadius,
          // iOS 27 can composite a transparent target against black during
          // the transition into the native context-menu preview.
          ...(IS_IOS_27_OR_ABOVE
            ? {
                backgroundColor: previewTheme?.isLight
                  ? previewTheme.colors2024['neutral-bg-1']
                  : previewTheme?.colors2024['neutral-bg-2'],
              }
            : {}),
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
        getChildren={getDynamicMenuChildren}
        loop={loop}
        alignOffset={alignOffset}
        avoidCollisions={avoidCollisions}
        collisionPadding={10}
      />
    </ContextMenu.Root>
  );
};
