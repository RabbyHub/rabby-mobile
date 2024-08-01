import { BottomSheetView } from '@gorhom/bottom-sheet';
import { Text } from 'react-native';
import AutoLockView from '../AutoLockView';

export const OneKeyInputPassphrase = () => {
  return (
    <AutoLockView as="BottomSheetView">
      <Text>123</Text>
    </AutoLockView>
  );
};
