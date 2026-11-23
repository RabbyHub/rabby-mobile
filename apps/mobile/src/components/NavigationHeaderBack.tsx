import React from 'react';
import { StyleSheet } from 'react-native';
import type { NativeStackHeaderLeftProps } from '@react-navigation/native-stack';

import { apisTheme, useGetBinaryMode } from '@/hooks/theme';
import { navigationRef } from '@/utils/navigation';
import { CustomTouchableOpacity } from '@/components/CustomTouchableOpacity';
import { default as RcIconHeaderBack } from '@/assets/icons/header/back-cc.svg';
import { RootNames } from '@/constant/layout';

/**
 * Header back controls shared by the navigator (native header slots) and the
 * JS header rows.
 *
 * They live in their own module so `hooks/navigation.tsx` (which needs the
 * controls) and `components/FoldableStackHeader.tsx` (which is imported by the
 * navigator) can both use the same implementation without forming an import
 * cycle.
 */

const hitSlop = {
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
};

export function navBack() {
  const navigation = navigationRef.current;
  if (navigation?.canGoBack()) {
    navigation.goBack();
  } else {
    navigationRef.resetRoot({
      index: 0,
      routes: [{ name: RootNames.Home }],
    });
  }
}

/**
 * Header back control with no baked-in layout compensation.
 *
 * Renders a plain 24x24 icon box, so whoever renders the header row owns every
 * inset explicitly. Screens that draw their own header (`header: () => ...`)
 * must use this instead of the deprecated `HeaderBackPressable`, otherwise the
 * compensation margin below silently shrinks the leading slot and pulls centred
 * sibling content off the screen centre (QA 1344).
 *
 * Where the compensation came from: `HeaderBackPressable` was written for
 * controls hosted by a native header element, where iOS 26 +
 * react-native-screens stop applying the system bar-item inset (#1283). It
 * compensates from the inside (`marginLeft: -16` + `paddingLeft: 16`), which is
 * only correct while the host supplies that same 16pt leading inset. In a JS
 * header the negative margin has no such inset to cancel: the slot collapses
 * from 24pt to 8pt and everything after it shifts.
 *
 * If this control is ever dropped into a host that does (or does not) provide a
 * bar-item inset, compensate at the call site - pass `style` (a
 * `marginLeft`/`paddingLeft`) or wrap it in a sized slot - and never re-add the
 * inset inside the component itself.
 */
export function HeaderBackButton({
  tintColor,
  style,
  hitSlop: hitSlopProp,
  ...touchableProps
}: Pick<NativeStackHeaderLeftProps, 'tintColor'> &
  RNViewProps & { hitSlop?: typeof hitSlop }) {
  const themeMode = useGetBinaryMode();
  const { colors2024 } = apisTheme.getColors2024(themeMode);
  return (
    <CustomTouchableOpacity
      // Native-stack header controls need native gesture arbitration on Fabric.
      as="RNGHTouchableOpacity"
      {...touchableProps}
      style={[headerBackStyles.headerBackButtonStyle, style]}
      hitSlop={hitSlopProp ?? hitSlop}
      onPress={navBack}>
      <RcIconHeaderBack
        width={24}
        height={24}
        color={tintColor || colors2024['neutral-body']}
      />
    </CustomTouchableOpacity>
  );
}

/**
 * @deprecated Bakes a native-bar-item inset compensation into the control
 * (`marginLeft: -16` + `paddingLeft: 16`). Kept only for controls hosted by a
 * native header element (Android `headerLeft`). Any screen that renders its own
 * header row must use `HeaderBackButton` and apply its own container/padding.
 */
export function HeaderBackPressable({
  tintColor,
  style,
  ...touchableProps
}: Pick<NativeStackHeaderLeftProps, 'tintColor'> & RNViewProps) {
  const themeMode = useGetBinaryMode();
  const { colors2024 } = apisTheme.getColors2024(themeMode);
  return (
    <CustomTouchableOpacity
      // Native-stack header controls need native gesture arbitration on Fabric.
      as="RNGHTouchableOpacity"
      {...touchableProps}
      style={[headerBackStyles.backButtonStyle, style]}
      hitSlop={hitSlop}
      onPress={navBack}>
      <RcIconHeaderBack
        width={24}
        height={24}
        color={tintColor || colors2024['neutral-body']}
      />
    </CustomTouchableOpacity>
  );
}

export const headerBackStyles = StyleSheet.create({
  // Plain icon box for JS-rendered custom headers; the caller aligns it.
  headerBackButtonStyle: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonStyle: {
    alignItems: 'center',
    flexDirection: 'row',
    marginLeft: -16,
    paddingLeft: 16,
  },
});
