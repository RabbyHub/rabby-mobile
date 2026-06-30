import type { MenuComponentProps, MenuAction, NativeActionEvent, MenuComponentRef } from "./types";
declare const MenuView: import("react").ForwardRefExoticComponent<{
    style?: import("react-native").StyleProp<import("react-native").ViewStyle>;
    onPressAction?: ({ nativeEvent }: NativeActionEvent) => void;
    onCloseMenu?: () => void;
    onOpenMenu?: () => void;
    actions: MenuAction[];
    title?: string;
    isAnchoredToRight?: boolean;
    shouldOpenOnLongPress?: boolean;
    themeVariant?: string;
    androidSuppressNativeLongPress?: boolean;
    hitSlop?: {
        top: number;
        bottom: number;
        left: number;
        right: number;
    };
    testID?: string;
} & {
    children?: import("react").ReactNode | undefined;
} & import("react").RefAttributes<MenuComponentRef>>;
export { MenuView };
export type { MenuComponentProps, MenuComponentRef, MenuAction, NativeActionEvent, };
//# sourceMappingURL=index.d.ts.map