/// <reference types="react" />
import Animated from 'react-native-reanimated';
import { Ref, RefComponent } from './types';
/** The time one frame takes at 60 fps (16 ms) */
export declare const ONE_FRAME_MS = 16;
/** check if app is in RTL mode or not */
export declare const isRTL: boolean;
export declare const IS_IOS: boolean;
export declare const AnimatedFlatList: import("react").ComponentClass<Animated.AnimateProps<import("react-native/types").FlatListProps<unknown>>, any>;
export declare const AnimatedSectionList: import("react").ComponentClass<Animated.AnimateProps<import("react-native/types").SectionListProps<unknown, unknown>>, any>;
export declare function scrollToImpl<T extends RefComponent>(ref: Ref<T> | undefined, x: number, y: number, animated: boolean): void;
