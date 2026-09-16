import RcCheckboxChecked from '@/assets2024/icons/perps/PerpsProInfoCheckboxChecked.svg';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { PERPS_PRO_DIALOG_TOKENS } from './perpsProDialogVisual';

/** Visual only: each caller retains its own press and accessibility semantics. */
export const PerpsProCheckboxIcon = ({
  checked,
  checkColor,
  testID,
}: {
  checked: boolean;
  checkColor: string;
  testID?: string;
}) =>
  checked ? (
    <RcCheckboxChecked
      color={PERPS_PRO_DIALOG_TOKENS.actionBackground}
      stroke={checkColor}
      height={20}
      width={20}
      testID={testID}
    />
  ) : (
    <View style={styles.frame}>
      <View style={styles.empty} testID={testID} />
    </View>
  );

const styles = StyleSheet.create({
  frame: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.25,
    borderColor: PERPS_PRO_DIALOG_TOKENS.checkboxBorder,
  },
});
