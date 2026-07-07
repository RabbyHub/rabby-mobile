import type { DirectEventHandler, Int32 } from "react-native/Libraries/Types/CodegenTypes";
import type { HostComponent, ViewProps } from "react-native";
type SubAction = {
    id?: string;
    title: string;
    titleColor?: Int32;
    subtitle?: string;
    state?: string;
    image?: string;
    imageColor?: Int32;
    displayInline?: boolean;
    attributes?: {
        destructive?: boolean;
        disabled?: boolean;
        hidden?: boolean;
    };
};
type MenuAction = {
    id?: string;
    title: string;
    titleColor?: Int32;
    subtitle?: string;
    state?: string;
    image?: string;
    imageColor?: Int32;
    displayInline?: boolean;
    attributes?: {
        destructive?: boolean;
        disabled?: boolean;
        hidden?: boolean;
    };
    subactions?: Array<SubAction>;
};
export interface NativeProps extends ViewProps {
    onPressAction?: DirectEventHandler<{
        event: string;
    }>;
    onCloseMenu?: DirectEventHandler<{
        event: string;
    }>;
    onOpenMenu?: DirectEventHandler<{
        event: string;
    }>;
    actions: Array<MenuAction>;
    actionsHash: string;
    title?: string;
    isAnchoredToRight?: boolean;
    themeVariant?: string;
    suppressNativeLongPress?: boolean;
    shouldOpenOnLongPress?: boolean;
    hitSlop: {
        top: Int32;
        bottom: Int32;
        left: Int32;
        right: Int32;
    };
}
declare const _default: HostComponent<NativeProps>;
export default _default;
//# sourceMappingURL=UIMenuNativeComponent.d.ts.map