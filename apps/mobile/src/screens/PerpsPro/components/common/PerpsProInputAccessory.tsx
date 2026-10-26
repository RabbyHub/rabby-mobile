import React, { useCallback, useSyncExternalStore } from 'react';
import { InputAccessoryView, useWindowDimensions } from 'react-native';
import { PerpsProKeyboardAccessoryBar } from './PerpsProKeyboardAccessoryBar';
import { dismissPerpsProKeyboard } from './dismissPerpsProKeyboard';
import {
  getPerpsProKeyboardAccessoryID,
  usesPerpsProInputAccessory,
} from './perpsProKeyboardAccessoryBinding';
import { perpsProKeyboardSession } from './perpsProKeyboardSession';

const FabricInputAccessory = ({ nativeID }: { nativeID: string }) => {
  const getMinimum = useCallback(() => {
    const focused = perpsProKeyboardSession.getSnapshot();
    return focused && getPerpsProKeyboardAccessoryID(focused.id) === nativeID
      ? focused.minimum
      : null;
  }, [nativeID]);
  // A primitive snapshot keeps unrelated focus/minimum changes out of this leaf.
  const minimum = useSyncExternalStore(
    perpsProKeyboardSession.subscribe,
    getMinimum,
    getMinimum,
  );
  const { width } = useWindowDimensions();
  return (
    <InputAccessoryView nativeID={nativeID}>
      <PerpsProKeyboardAccessoryBar
        minimum={minimum}
        onDone={dismissPerpsProKeyboard}
        width={width}
      />
    </InputAccessoryView>
  );
};

/**
 * Render AFTER the associated input, in the same mount/Portal boundary.
 * RN 0.81 Fabric finds only one matching input when the host enters its window.
 * Keep both the host and its unique ID stable across focus and draft updates.
 */
export const PerpsProInputAccessory = React.memo(
  ({ nativeID }: { nativeID: string | undefined }) =>
    usesPerpsProInputAccessory() && nativeID ? (
      <FabricInputAccessory nativeID={nativeID} />
    ) : null,
);
