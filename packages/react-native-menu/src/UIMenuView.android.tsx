import {
	findNodeHandle,
	type HostComponent,
	UIManager,
} from "react-native";
import type { MenuComponentRef, NativeMenuComponentProps } from "./types";
import { forwardRef, useImperativeHandle, useRef } from "react";
import codegenNativeCommands from "react-native/Libraries/Utilities/codegenNativeCommands";
import NativeMenuComponent from "./UIMenuViewNativeHost";

type RefT = React.ElementRef<HostComponent<NativeMenuComponentProps>>;

const Commands = codegenNativeCommands<{
	show: (viewRef: RefT) => void;
}>({
	supportedCommands: ["show"],
});

const MenuComponent = forwardRef<MenuComponentRef, NativeMenuComponentProps>(
	({ androidSuppressNativeLongPress = false, ...props }, ref) => {
		const nativeRef = useRef(null);

		useImperativeHandle(
			ref,
			() => ({
				show: () => {
					if (nativeRef.current) {
						// biome-ignore lint/suspicious/noExplicitAny: React Native runtime flags like nativeFabricUIManager are not in TypeScript types. Using `any` here is intentional and safe.
						const isFabric = !!(global as any).nativeFabricUIManager;

						if (isFabric) {
							Commands.show(nativeRef.current);
						} else {
							const node = findNodeHandle(nativeRef.current);
							const command =
								UIManager.getViewManagerConfig("MenuView").Commands.show;

							UIManager.dispatchViewManagerCommand(node, command, undefined);
						}
					}
				},
			}),
			[],
		);

		return (
			<NativeMenuComponent
				suppressNativeLongPress={androidSuppressNativeLongPress}
				{...props}
				ref={nativeRef}
			/>
		);
	},
);

export default MenuComponent;
