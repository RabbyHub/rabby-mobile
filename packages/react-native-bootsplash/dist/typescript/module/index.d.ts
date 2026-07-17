import { type ImageRequireSource, type ImageResizeMode, type ImageSourcePropType, type ImageStyle, type ViewStyle } from "react-native";
export type Config = {
    fade?: boolean;
};
export type Manifest = {
    background: string;
    darkBackground?: string;
    logo: {
        width: number;
        height: number;
    };
    brand?: {
        bottom: number;
        width: number;
        height: number;
    };
};
export type UseHideAnimationConfig = {
    manifest: Manifest;
    ready?: boolean;
    logo?: ImageRequireSource;
    darkLogo?: ImageRequireSource;
    brand?: ImageRequireSource;
    darkBrand?: ImageRequireSource;
    animate: () => void;
    statusBarTranslucent?: boolean;
    navigationBarTranslucent?: boolean;
};
export type ContainerProps = {
    style: ViewStyle;
    onLayout: () => void;
};
export type LogoProps = {
    source: ImageSourcePropType;
    fadeDuration?: number;
    resizeMode?: ImageResizeMode;
    style?: ImageStyle;
    onLoadEnd?: () => void;
};
export type BrandProps = {
    source: ImageSourcePropType;
    fadeDuration?: number;
    resizeMode?: ImageResizeMode;
    style?: ImageStyle;
    onLoadEnd?: () => void;
};
export type UseHideAnimation = {
    container: ContainerProps;
    logo: LogoProps;
    brand: BrandProps;
};
export declare function hide(config?: Config): Promise<void>;
export declare function isVisible(): boolean;
export declare function useHideAnimation(config: UseHideAnimationConfig): UseHideAnimation;
declare const _default: {
    hide: typeof hide;
    isVisible: typeof isVisible;
    useHideAnimation: typeof useHideAnimation;
};
export default _default;
//# sourceMappingURL=index.d.ts.map