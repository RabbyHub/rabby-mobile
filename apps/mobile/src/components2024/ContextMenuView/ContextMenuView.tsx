// Context menus are centralized here so app code cannot bypass open-time
// action snapshots or the platform-specific native menu fixes.
// eslint-disable-next-line no-restricted-imports
import * as ContextMenu from '@rabby-wallet/zeego/context-menu';
import { MenuTriggerProps } from '@rabby-wallet/zeego/menu';
import type { ContextMenuContentProps } from '@radix-ui/react-context-menu';
import { ImageSourcePropType, Platform, View } from 'react-native';
import { IS_ANDROID } from '@/core/native/utils';
import { apisTheme } from '@/hooks/theme';
import { memo, useCallback, useMemo, useRef } from 'react';
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
  menuActions: MenuAction[];
}

type Props = {
  menuTitle?: string;
  /**
   * Read action state only when the native menu opens. This avoids subscribing
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

const ContextMenuViewInner = ({
  children,
  menuTitle,
  getMenuConfig,
  loop = true,
  alignOffset = 5,
  avoidCollisions = true,
  triggerProps,
  preViewBorderRadius = 30,
  androidLongPressDuration = 350,
}: Props) => {
  const androidMenuViewRef = useRef<MenuComponentRef>(null);

  const androidShowMenu = useCallback(() => {
    // touchedFeedback();
    androidMenuViewRef.current?.show();
  }, []);

  const needUseGdOnAndroid = IS_ANDROID && triggerProps?.action === 'longPress';
  const longPressGesture = useMemo(() => {
    if (!needUseGdOnAndroid) {
      return null;
    }
    return Gesture.LongPress()
      .minDuration(androidLongPressDuration)
      .runOnJS(false)
      .onStart(() => {
        runOnJS(androidShowMenu)();
      });
  }, [androidLongPressDuration, androidShowMenu, needUseGdOnAndroid]);
  const getDynamicMenuChildren = useCallback(
    () => renderMenuActions(getMenuConfig()),
    [getMenuConfig],
  );

  const previewTheme = IS_IOS_27_OR_ABOVE
    ? apisTheme.getColors2024()
    : undefined;
  const previewBackgroundColor = previewTheme
    ? previewTheme.colors2024[
        previewTheme.isLight ? 'neutral-bg-1' : 'neutral-bg-2'
      ]
    : undefined;
  const iosProps = useMemo(
    () => ({
      previewConfig: {
        borderRadius: preViewBorderRadius,
        // iOS 27 can composite a transparent target against black during preview.
        ...(previewBackgroundColor !== undefined && {
          backgroundColor: previewBackgroundColor,
        }),
      },
    }),
    [preViewBorderRadius, previewBackgroundColor],
  );

  return (
    <ContextMenu.Root
      __unsafeIosProps={iosProps}
      androidMenuViewRef={androidMenuViewRef}>
      <ContextMenu.Trigger
        action="longPress"
        {...triggerProps}
        isAnchoredToRight
        {...(needUseGdOnAndroid && {
          androidSuppressNativeLongPress: true,
          action: 'longPress',
        })}>
        {longPressGesture ? (
          <GestureDetector gesture={longPressGesture}>
            {/* Composite children may drop GestureDetector's collapsable prop. */}
            <View collapsable={false}>{children}</View>
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
        collisionPadding={10}>
        {menuTitle ? <ContextMenu.Label>{menuTitle}</ContextMenu.Label> : null}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
};

export const ContextMenuView = memo(ContextMenuViewInner);
