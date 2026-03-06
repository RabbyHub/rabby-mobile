import { BottomSheetView } from '@gorhom/bottom-sheet';
import AutoLockView from '../AutoLockView';
import { Text } from '@/components/Typography';

export const OneKeyInputPassphrase = () => {
  return (
    <AutoLockView as="BottomSheetView">
      <Text>123</Text>
    </AutoLockView>
  );
};
