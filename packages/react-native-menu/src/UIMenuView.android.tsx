import {
	findNodeHandle,
	type HostComponent,
	requireNativeComponent,
	UIManager,
} from "react-native";
import type {
	NativeMenuComponentRef,
	NativeMenuComponentProps,
} from "./types";
import { forwardRef, useImperativeHandle, useRef } from "react";

const NativeMenuComponent = requireNativeComponent(
	"MenuView",
) as HostComponent<NativeMenuComponentProps>;

const MenuComponent = forwardRef<NativeMenuComponentRef, NativeMenuComponentProps>(
	({ androidSuppressNativeLongPress = false, ...props }, ref) => {
		const nativeRef = useRef(null);

		useImperativeHandle(
			ref,
			() => ({
				show: (actions) => {
					if (nativeRef.current) {
						const node = findNodeHandle(nativeRef.current);
						const command =
							UIManager.getViewManagerConfig("MenuView").Commands.show;

						UIManager.dispatchViewManagerCommand(
							node,
							command,
							actions ? [actions] : undefined,
						);
					}
				},
			}),
			[],
		);

		return <NativeMenuComponent suppressNativeLongPress={androidSuppressNativeLongPress} {...props} ref={nativeRef} />;
	},
);

export default MenuComponent;
