import type { HostComponent } from "react-native";
import type { NativeMenuComponentProps } from "./types";

type StaticViewConfig = {
	uiViewClassName: string;
	directEventTypes: Record<string, { registrationName: string }>;
	validAttributes: Record<string, unknown>;
};

const NativeComponentRegistry = require("react-native/Libraries/NativeComponent/NativeComponentRegistry") as {
	get<Props>(
		name: string,
		viewConfigProvider: () => StaticViewConfig,
	): HostComponent<Props>;
};

const { ConditionallyIgnoredEventHandlers } =
	require("react-native/Libraries/NativeComponent/ViewConfigIgnore") as {
		ConditionallyIgnoredEventHandlers<T extends Record<string, true>>(
			value: T,
		): T | undefined;
	};

const ignoredEventHandlers = ConditionallyIgnoredEventHandlers({
	onPressAction: true,
	onCloseMenu: true,
	onOpenMenu: true,
});

const viewConfig: StaticViewConfig = {
	uiViewClassName: "MenuView",
	directEventTypes: {
		topPressAction: { registrationName: "onPressAction" },
		topCloseMenu: { registrationName: "onCloseMenu" },
		topOpenMenu: { registrationName: "onOpenMenu" },
	},
	validAttributes: {
		actions: true,
		actionsHash: true,
		title: true,
		themeVariant: true,
		isAnchoredToRight: true,
		suppressNativeLongPress: true,
		shouldOpenOnLongPress: true,
		hitSlop: true,
		...(ignoredEventHandlers ?? {}),
	},
};

export default NativeComponentRegistry.get<NativeMenuComponentProps>(
	"MenuView",
	() => viewConfig,
);
