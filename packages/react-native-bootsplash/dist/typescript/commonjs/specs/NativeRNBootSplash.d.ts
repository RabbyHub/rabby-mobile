import type { TurboModule } from "react-native";
export interface Spec extends TurboModule {
    getConstants(): {
        darkModeEnabled: boolean;
        logoSizeRatio?: number;
        navigationBarHeight?: number;
        statusBarHeight?: number;
    };
    hide(fade: boolean): Promise<void>;
    isVisible(): boolean;
}
declare const _default: Spec;
export default _default;
//# sourceMappingURL=NativeRNBootSplash.d.ts.map